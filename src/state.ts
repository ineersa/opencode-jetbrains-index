export type SessionState = {
	unboundedReadCountThisTurn: number;
	unboundedReadWarningSentThisTurn: boolean;
	consecutiveLargeReadCountThisTurn: number;
	nearReadBlockWarningSentThisTurn: boolean;
	nonSymbolicStreakCountThisTurn: number;
	lastNonSymbolicDenyAt: number;
	lastReadReminderAt: number;
	lastMoveReminderAt: number;
	sessionStartNudgePending: boolean;
	sessionStartNudgeShown: boolean;
};

function createInitialSessionState(): SessionState {
	return {
		unboundedReadCountThisTurn: 0,
		unboundedReadWarningSentThisTurn: false,
		consecutiveLargeReadCountThisTurn: 0,
		nearReadBlockWarningSentThisTurn: false,
		nonSymbolicStreakCountThisTurn: 0,
		lastNonSymbolicDenyAt: 0,
		lastReadReminderAt: 0,
		lastMoveReminderAt: 0,
		sessionStartNudgePending: false,
		sessionStartNudgeShown: false,
	};
}

export class SessionStateStore {
	private readonly sessions = new Map<string, SessionState>();
	private readonly globalSessionId = "__global__";
	private toKey(sessionId?: string): string {
		if (typeof sessionId === "string" && sessionId.trim().length > 0) {
			return sessionId;
		}
		return this.globalSessionId;
	}

	ensure(sessionId?: string): SessionState {
		const key = this.toKey(sessionId);
		let state = this.sessions.get(key);
		if (!state) {
			state = createInitialSessionState();
			this.sessions.set(key, state);
		}
		return state;
	}

	resetTurn(sessionId?: string): void {
		const state = this.ensure(sessionId);
		state.unboundedReadCountThisTurn = 0;
		state.unboundedReadWarningSentThisTurn = false;
		state.consecutiveLargeReadCountThisTurn = 0;
		state.nearReadBlockWarningSentThisTurn = false;
		state.nonSymbolicStreakCountThisTurn = 0;
	}

	resetReadStreak(sessionId?: string): void {
		const state = this.ensure(sessionId);
		state.unboundedReadCountThisTurn = 0;
		state.unboundedReadWarningSentThisTurn = false;
		state.consecutiveLargeReadCountThisTurn = 0;
		state.nearReadBlockWarningSentThisTurn = false;
	}

	markSessionNudgePending(sessionId?: string): void {
		const state = this.ensure(sessionId);
		if (!state.sessionStartNudgeShown) {
			state.sessionStartNudgePending = true;
		}
	}

	consumeSessionNudge(sessionId?: string): boolean {
		const state = this.ensure(sessionId);
		if (!state.sessionStartNudgePending) {
			return false;
		}
		state.sessionStartNudgePending = false;
		state.sessionStartNudgeShown = true;
		return true;
	}

	clear(sessionId?: string): void {
		const key = this.toKey(sessionId);
		this.sessions.delete(key);
	}

	clearAll(): void {
		this.sessions.clear();
	}
}
