import { SourceActorProxy, BreakpointActorProxy } from '../firefox/index';
import { BreakpointInfo } from './index';
import { DebugProtocol } from 'vscode-debugprotocol';

export class SourceAdapter {
	
	public id: number;
	public actor: SourceActorProxy;
	public sourcePath: string;
	public currentBreakpoints: Promise<BreakpointAdapter[]>;

	public constructor(id: number, actor: SourceActorProxy, sourcePath: string) {
		this.id = id;
		this.actor = actor;
		this.sourcePath = sourcePath;
		this.currentBreakpoints = Promise.resolve([]);
	}
}

export class BreakpointAdapter {
	
	public breakpointInfo: BreakpointInfo;
	public actor: BreakpointActorProxy;
	
	public constructor(requestedBreakpoint: BreakpointInfo, actor: BreakpointActorProxy) {
		this.breakpointInfo = requestedBreakpoint;
		this.actor = actor;
	}
}

