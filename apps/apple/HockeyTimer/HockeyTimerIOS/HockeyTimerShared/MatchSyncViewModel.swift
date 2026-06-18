import Foundation
import Combine

class MatchSyncViewModel: ObservableObject {
    @Published var homeScore: Int = 0
    @Published var awayScore: Int = 0
    @Published var isRunning: Bool = false
    @Published var isEnded: Bool = false
    @Published var currentPeriod: Int = 1
    @Published var currentPeriodPlayedSeconds: Int = 0
    @Published var periodCount: Int = 4
    @Published var periodDurationSeconds: Int = 17 * 60 + 30
    @Published var periodDurationSecondsByPeriod: [Int] = Array(repeating: 17 * 60 + 30, count: 4)
    @Published var pendingEventCount: Int = 0
    @Published var lastError: String?
    @Published var runningStartedAt: Date?

    private var matchId: String
    private let originPlatform: String
    private let deviceIdKey: String
    private let sequenceKey: String
    private let apiBaseKey: String
    private let defaultApiBase: String
    private let activeMatchIdKey: String?
    private let isPreview: Bool
    private let previewApiBase: String?
    private var queueStore: PendingEventStore
    private var localProjectionStore: LocalMatchProjectionStore?

    init(
        matchId: String,
        originPlatform: String,
        deviceIdKey: String,
        sequenceKey: String,
        apiBaseKey: String,
        defaultApiBase: String,
        activeMatchIdKey: String? = nil,
        isPreview: Bool = false,
        previewApiBase: String? = nil
    ) {
        let activeMatchId = isPreview
            ? matchId
            : activeMatchIdKey.flatMap { UserDefaults.standard.string(forKey: $0) } ?? matchId
        self.matchId = activeMatchId
        self.originPlatform = originPlatform
        self.deviceIdKey = deviceIdKey
        self.sequenceKey = sequenceKey
        self.apiBaseKey = apiBaseKey
        self.defaultApiBase = defaultApiBase
        self.activeMatchIdKey = activeMatchIdKey
        self.isPreview = isPreview
        self.previewApiBase = previewApiBase
        self.queueStore = PendingEventStore(
            key: "hockeytimer.pending-events.\(originPlatform).\(activeMatchId)"
        )
        self.localProjectionStore = activeMatchIdKey.map { _ in
            LocalMatchProjectionStore(
                key: "hockeytimer.local-projection.\(originPlatform).\(activeMatchId)"
            )
        }

        guard !isPreview else { return }

        loadLocalProjection()
        Task {
            await updatePendingEventCount()
        }
    }

    var stateLabel: String {
        if isEnded { return "ENDED" }
        return isRunning ? "RUNNING" : "PAUSED"
    }

    var periodLabel: String {
        "P\(currentPeriod)"
    }

    var timeLabel: String {
        let remaining = periodDurationSeconds - currentPeriodPlayedSeconds
        if remaining >= 0 {
            return "\(format(seconds: remaining)) remaining"
        }
        return "+\(format(seconds: abs(remaining))) over"
    }

    var watchTimeText: String {
        WatchPresentation.timeText(
            periodDurationSeconds: periodDurationSeconds,
            playedSeconds: localCurrentPeriodPlayedSeconds()
        )
    }

    var watchTimeIsOvertime: Bool {
        WatchPresentation.isOvertime(
            periodDurationSeconds: periodDurationSeconds,
            playedSeconds: localCurrentPeriodPlayedSeconds()
        )
    }

    var periodProgressLabel: String {
        WatchPresentation.periodProgressLabel(
            currentPeriod: currentPeriod,
            periodCount: periodCount
        )
    }

    var nextPeriodTitle: String {
        WatchPresentation.nextPeriodTitle(
            currentPeriod: currentPeriod,
            periodCount: periodCount
        )
    }

    var canDecrementHome: Bool {
        homeScore > 0
    }

    var canDecrementAway: Bool {
        awayScore > 0
    }

    var canResetScore: Bool {
        homeScore != 0 || awayScore != 0
    }

    var currentApiBase: String {
        if isPreview { return previewApiBase ?? defaultApiBase }
        return UserDefaults.standard.string(forKey: apiBaseKey) ?? defaultApiBase
    }

    func updateApiBase(_ value: String) {
        guard !isPreview else { return }
        let sanitized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else { return }
        UserDefaults.standard.set(sanitized, forKey: apiBaseKey)
    }

    func refreshProjection() {
        guard !isPreview else { return }
        Task {
            do {
                try? await flushQueuedEvents()
                let projection = try await fetchProjection()
                await MainActor.run {
                    homeScore = projection.homeScore
                    awayScore = projection.awayScore
                    if pendingEventCount > 0 {
                        lastError = nil
                        return
                    }
                    isRunning = projection.isRunning
                    isEnded = projection.isEnded
                    currentPeriod = projection.currentPeriod
                    currentPeriodPlayedSeconds = projection.currentPeriodPlayedSeconds
                    runningStartedAt = projection.isRunning ? Date() : nil
                    periodCount = projection.format.periodCount
                    periodDurationSecondsByPeriod = projection.format.periodDurationSeconds
                    let periodIndex = max(0, projection.currentPeriod - 1)
                    periodDurationSeconds = projection.format.periodDurationSeconds.indices.contains(periodIndex)
                        ? projection.format.periodDurationSeconds[periodIndex]
                        : 0
                    lastError = nil
                    saveLocalProjection()
                }
            } catch {
                await MainActor.run {
                    lastError = error.localizedDescription
                }
            }
        }
    }

    func start() { push(eventType: "match.started", payload: .empty) }
    func pause() { push(eventType: "match.paused", payload: .empty) }
    func resume() { push(eventType: "match.resumed", payload: .empty) }
    func endPeriod() { push(eventType: "period.ended", payload: .empty) }
    func endMatch() { push(eventType: "match.ended", payload: .empty) }

    func incrementHome() {
        push(eventType: "score.changed", payload: .score(team: "home", delta: 1, reason: "goal"))
    }

    func incrementAway() {
        push(eventType: "score.changed", payload: .score(team: "away", delta: 1, reason: "goal"))
    }

    func decrementHome() {
        push(eventType: "score.changed", payload: .score(team: "home", delta: -1, reason: "correction"))
    }

    func decrementAway() {
        push(eventType: "score.changed", payload: .score(team: "away", delta: -1, reason: "correction"))
    }

    func resetScore() {
        if homeScore != 0 {
            push(eventType: "score.changed", payload: .score(team: "home", delta: -homeScore, reason: "correction"))
        }

        if awayScore != 0 {
            push(eventType: "score.changed", payload: .score(team: "away", delta: -awayScore, reason: "correction"))
        }
    }

    func createQuickMatch(format: WatchMatchFormat = WatchPresentation.defaultNewMatchFormat) {
        guard !isPreview else { return }
        let newMatchId = "watch-\(UUID().uuidString.lowercased())"
        let newQueueStore = PendingEventStore(
            key: "hockeytimer.pending-events.\(originPlatform).\(newMatchId)"
        )
        let newLocalProjectionStore = LocalMatchProjectionStore(
            key: "hockeytimer.local-projection.\(originPlatform).\(newMatchId)"
        )
        matchId = newMatchId
        if let activeMatchIdKey {
            UserDefaults.standard.set(newMatchId, forKey: activeMatchIdKey)
        }
        queueStore = newQueueStore
        localProjectionStore = newLocalProjectionStore

        homeScore = 0
        awayScore = 0
        isRunning = false
        isEnded = false
        currentPeriod = 1
        currentPeriodPlayedSeconds = 0
        runningStartedAt = nil
        periodCount = format.periodCount
        periodDurationSecondsByPeriod = format.periodDurationSeconds
        periodDurationSeconds = format.periodDurationSeconds.first ?? 0
        lastError = nil
        saveLocalProjection()

        let now = ISO8601DateFormatter().string(from: Date())
        let events = [
            makeEvent(eventType: "match.created", payload: .empty, matchId: newMatchId, occurredAt: now),
            makeEvent(
                eventType: "match.format.updated",
                payload: .format(
                    periodCount: format.periodCount,
                    periodDurationSeconds: format.periodDurationSeconds
                ),
                matchId: newMatchId,
                occurredAt: now
            ),
        ]

        Task {
            for event in events {
                await newQueueStore.append(event)
            }
            await updatePendingEventCount()

            do {
                try await flushQueuedEvents(from: newQueueStore, for: newMatchId)
                refreshProjection()
            } catch {
                await MainActor.run {
                    lastError = error.localizedDescription
                }
            }
        }
    }

    private func push(eventType: String, payload: MatchEventPayload) {
        guard !isPreview else { return }
        let eventMatchId = matchId
        let eventQueueStore = queueStore
        let event = makeEvent(
            eventType: eventType,
            payload: payload,
            matchId: eventMatchId,
            occurredAt: ISO8601DateFormatter().string(from: Date())
        )
        applyLocal(event: event)
        saveLocalProjection()

        Task {
            await eventQueueStore.append(event)
            if eventMatchId == matchId {
                await updatePendingEventCount()
            }

            do {
                try await flushQueuedEvents(from: eventQueueStore, for: eventMatchId)
                if eventMatchId == matchId {
                    refreshProjection()
                }
            } catch {
                if eventMatchId == matchId {
                    await MainActor.run {
                        lastError = error.localizedDescription
                    }
                }
            }
        }
    }

    private func makeEvent(
        eventType: String,
        payload: MatchEventPayload,
        matchId: String,
        occurredAt: String
    ) -> MatchEventDTO {
        MatchEventDTO(
            eventId: UUID().uuidString.lowercased(),
            matchId: matchId,
            eventType: eventType,
            occurredAt: occurredAt,
            originDeviceId: deviceId(),
            originPlatform: originPlatform,
            sequence: nextSequence(),
            payload: payload,
            version: 1
        )
    }

    private func applyLocal(event: MatchEventDTO) {
        let occurredAt = parseDate(event.occurredAt) ?? Date()

        if event.eventType == "score.changed" {
            let delta = event.payload.delta ?? 0
            if event.payload.team == "home" {
                homeScore = max(0, homeScore + delta)
            } else if event.payload.team == "away" {
                awayScore = max(0, awayScore + delta)
            }
        }

        if event.eventType == "match.format.updated" {
            if let payloadPeriodCount = event.payload.periodCount,
               let payloadDurations = event.payload.periodDurationSeconds,
               !payloadDurations.isEmpty {
                periodCount = payloadPeriodCount
                periodDurationSecondsByPeriod = payloadDurations
                let periodIndex = max(0, currentPeriod - 1)
                periodDurationSeconds = payloadDurations.indices.contains(periodIndex)
                    ? payloadDurations[periodIndex]
                    : payloadDurations[0]
            }
        }

        if event.eventType == "match.started" || event.eventType == "match.resumed" {
            guard !isEnded else { return }
            isRunning = true
            runningStartedAt = occurredAt
        }

        if event.eventType == "match.paused" || event.eventType == "match.ended" || event.eventType == "period.ended" {
            updateCurrentPeriodPlayedSeconds(asOf: occurredAt)
            isRunning = false
            runningStartedAt = nil
        }

        if event.eventType == "period.ended" {
            currentPeriod = min(periodCount, currentPeriod + 1)
            currentPeriodPlayedSeconds = 0
            let periodIndex = max(0, currentPeriod - 1)
            periodDurationSeconds = periodDurationSecondsByPeriod.indices.contains(periodIndex)
                ? periodDurationSecondsByPeriod[periodIndex]
                : periodDurationSeconds
        }

        if event.eventType == "match.ended" {
            isEnded = true
        }
    }

    func localCurrentPeriodPlayedSeconds(on date: Date = Date()) -> Int {
        guard isRunning, let runningStartedAt else {
            return currentPeriodPlayedSeconds
        }

        let liveDelta = max(0, Int(date.timeIntervalSince(runningStartedAt)))
        return currentPeriodPlayedSeconds + liveDelta
    }

    func watchTimeText(on date: Date) -> String {
        WatchPresentation.timeText(
            periodDurationSeconds: periodDurationSeconds,
            playedSeconds: localCurrentPeriodPlayedSeconds(on: date)
        )
    }

    func watchTimeIsOvertime(on date: Date) -> Bool {
        WatchPresentation.isOvertime(
            periodDurationSeconds: periodDurationSeconds,
            playedSeconds: localCurrentPeriodPlayedSeconds(on: date)
        )
    }

    private func updateCurrentPeriodPlayedSeconds(asOf date: Date) {
        guard let runningStartedAt else { return }
        let liveDelta = max(0, Int(date.timeIntervalSince(runningStartedAt)))
        currentPeriodPlayedSeconds += liveDelta
    }

    private func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: value)
    }

    private func saveLocalProjection() {
        guard !isPreview else { return }
        let projection = LocalMatchProjection(
            homeScore: homeScore,
            awayScore: awayScore,
            isRunning: isRunning,
            isEnded: isEnded,
            currentPeriod: currentPeriod,
            currentPeriodPlayedSeconds: currentPeriodPlayedSeconds,
            periodCount: periodCount,
            periodDurationSeconds: periodDurationSeconds,
            periodDurationSecondsByPeriod: periodDurationSecondsByPeriod,
            runningStartedAt: runningStartedAt?.timeIntervalSince1970
        )
        localProjectionStore?.save(projection)
    }

    private func loadLocalProjection() {
        guard !isPreview else { return }
        guard let projection = localProjectionStore?.load() else {
            return
        }

        homeScore = projection.homeScore
        awayScore = projection.awayScore
        isRunning = projection.isRunning
        isEnded = projection.isEnded
        currentPeriod = projection.currentPeriod
        currentPeriodPlayedSeconds = projection.currentPeriodPlayedSeconds
        periodCount = projection.periodCount
        periodDurationSeconds = projection.periodDurationSeconds
        periodDurationSecondsByPeriod = projection.periodDurationSecondsByPeriod
        runningStartedAt = projection.runningStartedAt.map {
            Date(timeIntervalSince1970: $0)
        }
    }

    private func flushQueuedEvents() async throws {
        guard !isPreview else { return }
        try await flushQueuedEvents(from: queueStore, for: matchId)
    }

    private func flushQueuedEvents(from store: PendingEventStore, for matchId: String) async throws {
        guard !isPreview else { return }
        let events = await store.load()
        guard !events.isEmpty else {
            return
        }

        try await pushEvents(events, matchId: matchId)
        await store.clear()
        await updatePendingEventCount()
    }

    private func pushEvents(_ events: [MatchEventDTO], matchId: String) async throws {
        guard !isPreview else { return }
        guard let url = URL(string: "\(currentApiBase)/matches/\(matchId)/events:batchUpsert") else {
            return
        }

        let body = MatchBatchUpsertBody(events: events)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "content-type")
        if let authorization = AppleApiEndpointSync.shared.currentAuthorizationHeader() {
            request.addValue(authorization, forHTTPHeaderField: "authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "MatchSyncViewModel", code: 1, userInfo: [NSLocalizedDescriptionKey: "Event upsert failed"])
        }
    }

    private func fetchProjection() async throws -> MatchProjectionDTO {
        guard !isPreview else {
            throw NSError(domain: "MatchSyncViewModel", code: 4, userInfo: [NSLocalizedDescriptionKey: "Preview projection unavailable"])
        }
        guard let url = URL(string: "\(currentApiBase)/matches/\(matchId)/projection") else {
            throw NSError(domain: "MatchSyncViewModel", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid projection URL"])
        }

        var request = URLRequest(url: url)
        if let authorization = AppleApiEndpointSync.shared.currentAuthorizationHeader() {
            request.addValue(authorization, forHTTPHeaderField: "authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "MatchSyncViewModel", code: 3, userInfo: [NSLocalizedDescriptionKey: "Projection fetch failed"])
        }

        return try JSONDecoder().decode(MatchProjectionDTO.self, from: data)
    }

    private func deviceId() -> String {
        if let existing = UserDefaults.standard.string(forKey: deviceIdKey), !existing.isEmpty {
            return existing
        }

        let created = UUID().uuidString.lowercased()
        UserDefaults.standard.set(created, forKey: deviceIdKey)
        return created
    }

    private func nextSequence() -> Int {
        let current = UserDefaults.standard.integer(forKey: sequenceKey)
        let next = current + 1
        UserDefaults.standard.set(next, forKey: sequenceKey)
        return next
    }

    private func format(seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    private func updatePendingEventCount() async {
        guard !isPreview else { return }
        let count = await queueStore.count()
        await MainActor.run {
            pendingEventCount = count
        }
    }

    func seedPreview(
        homeScore: Int,
        awayScore: Int,
        isRunning: Bool,
        isEnded: Bool,
        currentPeriod: Int,
        currentPeriodPlayedSeconds: Int,
        periodCount: Int,
        periodDurationSeconds: Int,
        pendingEventCount: Int = 0,
        runningStartedAt: Date? = nil,
        lastError: String? = nil
    ) {
        guard isPreview else { return }
        self.homeScore = homeScore
        self.awayScore = awayScore
        self.isRunning = isRunning
        self.isEnded = isEnded
        self.currentPeriod = currentPeriod
        self.currentPeriodPlayedSeconds = currentPeriodPlayedSeconds
        self.periodCount = periodCount
        self.periodDurationSeconds = periodDurationSeconds
        self.periodDurationSecondsByPeriod = Array(repeating: periodDurationSeconds, count: periodCount)
        self.pendingEventCount = pendingEventCount
        self.runningStartedAt = runningStartedAt
        self.lastError = lastError
    }
}

actor PendingEventStore {
    private let key: String
    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(key: String) {
        self.key = key
    }

    func count() -> Int {
        load().count
    }

    func load() -> [MatchEventDTO] {
        guard let data = defaults.data(forKey: key) else {
            return []
        }

        return (try? decoder.decode([MatchEventDTO].self, from: data)) ?? []
    }

    func append(_ event: MatchEventDTO) {
        var events = load()
        events.append(event)
        save(events)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }

    private func save(_ events: [MatchEventDTO]) {
        guard let data = try? encoder.encode(events) else {
            return
        }
        defaults.set(data, forKey: key)
    }
}

private struct LocalMatchProjection: Codable {
    let homeScore: Int
    let awayScore: Int
    let isRunning: Bool
    let isEnded: Bool
    let currentPeriod: Int
    let currentPeriodPlayedSeconds: Int
    let periodCount: Int
    let periodDurationSeconds: Int
    let periodDurationSecondsByPeriod: [Int]
    let runningStartedAt: TimeInterval?
}

private struct LocalMatchProjectionStore {
    private let key: String
    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(key: String) {
        self.key = key
    }

    func load() -> LocalMatchProjection? {
        guard let data = defaults.data(forKey: key) else {
            return nil
        }

        return try? decoder.decode(LocalMatchProjection.self, from: data)
    }

    func save(_ projection: LocalMatchProjection) {
        guard let data = try? encoder.encode(projection) else {
            return
        }

        defaults.set(data, forKey: key)
    }
}
