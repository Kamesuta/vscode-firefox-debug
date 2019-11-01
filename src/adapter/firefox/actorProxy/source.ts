import { Log } from '../../util/log';
import { DebugConnection } from '../connection';
import { PendingRequests, PendingRequest } from '../../util/pendingRequests';
import { ActorProxy } from './interface';

let log = Log.create('SourceActorProxy');

export interface ISourceActorProxy {
	name: string;
	source: FirefoxDebugProtocol.Source;
	url: string | null;
	getBreakpointPositions(): Promise<FirefoxDebugProtocol.BreakpointPositions>;
	fetchSource(): Promise<FirefoxDebugProtocol.Grip>;
	setBlackbox(blackbox: boolean): Promise<void>;
	dispose(): void;
}

export interface Location {
	line: number,
	column?: number
}

/**
 * Proxy class for a source actor
 * ([docs](https://github.com/mozilla/gecko-dev/blob/master/devtools/docs/backend/protocol.md#loading-script-sources),
 * [spec](https://github.com/mozilla/gecko-dev/blob/master/devtools/shared/specs/source.js))
 */
export class SourceActorProxy implements ActorProxy, ISourceActorProxy {

	private pendingGetBreakpointPositionsRequest?: PendingRequest<FirefoxDebugProtocol.BreakpointPositions>;
	private getBreakpointPositionsPromise?: Promise<FirefoxDebugProtocol.BreakpointPositions>;
	private pendingFetchSourceRequests = new PendingRequests<FirefoxDebugProtocol.Grip>();
	private pendingBlackboxRequests = new PendingRequests<void>();
	
	constructor(
		public readonly source: FirefoxDebugProtocol.Source,
		private connection: DebugConnection
	) {
		this.connection.register(this);
	}

	public get name() {
		return this.source.actor;
	}

	public get url() {
		return this.source.url;
	}

	public getBreakpointPositions(): Promise<FirefoxDebugProtocol.BreakpointPositions> {
		if (!this.getBreakpointPositionsPromise) {
			log.debug(`Fetching breakpointPositions of ${this.url}`);

			this.getBreakpointPositionsPromise = new Promise<FirefoxDebugProtocol.BreakpointPositions>((resolve, reject) => {
				this.pendingGetBreakpointPositionsRequest = { resolve, reject };
				this.connection.sendRequest({ to: this.name, type: 'getBreakpointPositionsCompressed' });
			});
		}

		return this.getBreakpointPositionsPromise;
	}

	public fetchSource(): Promise<FirefoxDebugProtocol.Grip> {

		log.debug(`Fetching source of ${this.url}`);

		return new Promise<FirefoxDebugProtocol.Grip>((resolve, reject) => {
			this.pendingFetchSourceRequests.enqueue({ resolve, reject });
			this.connection.sendRequest({ to: this.name, type: 'source' });
		});
	}

	public setBlackbox(blackbox: boolean): Promise<void> {

		log.debug(`Setting blackboxing of ${this.url} to ${blackbox}`);

		this.source.isBlackBoxed = blackbox;

		return new Promise<void>((resolve, reject) => {
			let type = blackbox ? 'blackbox' : 'unblackbox';
			this.pendingBlackboxRequests.enqueue({ resolve, reject });
			this.connection.sendRequest({ to: this.name, type });
		});
	}

	public dispose(): void {
		this.connection.unregister(this);
	}

	public receiveResponse(response: FirefoxDebugProtocol.Response): void {

		if (response['positions'] !== undefined) {

			log.debug('Received getBreakpointPositions response');

			let breakpointPositionsResponse = <FirefoxDebugProtocol.GetBreakpointPositionsCompressedResponse>response;
			if (this.pendingGetBreakpointPositionsRequest) {
				this.pendingGetBreakpointPositionsRequest.resolve(breakpointPositionsResponse.positions);
				this.pendingGetBreakpointPositionsRequest = undefined;
			} else {
				log.warn(`Got BreakpointPositions ${this.url} without a corresponding request`);
			}

		} else if (response['source'] !== undefined) {

			log.debug('Received fetchSource response');
			let grip = <FirefoxDebugProtocol.Grip>response['source'];
			this.pendingFetchSourceRequests.resolveOne(grip);

		} else if (response['error'] === 'noSuchActor') {

			log.error(`No such actor ${JSON.stringify(this.name)}`);
			this.pendingFetchSourceRequests.rejectAll('No such actor');

		} else {

			let propertyCount = Object.keys(response).length;
			if ((propertyCount === 1) || ((propertyCount === 2) && (response['pausedInSource'] !== undefined))) {

				log.debug('Received (un)blackbox response');
				this.pendingBlackboxRequests.resolveOne(undefined);

			} else {

				log.warn("Unknown message from SourceActor: " + JSON.stringify(response));

			}
		}
	}
}
