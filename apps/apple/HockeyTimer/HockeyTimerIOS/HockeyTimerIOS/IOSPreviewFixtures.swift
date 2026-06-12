import Foundation

enum IOSPreviewFixtures {
    static let createdAt = Date(timeIntervalSince1970: 1_767_268_800)
    static let firstMatchDate = Date(timeIntervalSince1970: 1_768_131_000)
    static let secondMatchDate = Date(timeIntervalSince1970: 1_768_138_200)
    static let thirdMatchDate = Date(timeIntervalSince1970: 1_769_337_000)

    static let matches = [
        MatchListItem(
            id: "preview-custom-1",
            source: "custom",
            createdAt: createdAt,
            matchDateTime: firstMatchDate,
            homeTeam: "Amsterdam H1",
            awayTeam: "Rotterdam H1",
            clubName: "AH&BC Amsterdam",
            teamName: "Heren 1"
        ),
        MatchListItem(
            id: "preview-knhb-1",
            source: "knhb",
            createdAt: createdAt,
            matchDateTime: secondMatchDate,
            homeTeam: "SCHC D1",
            awayTeam: "Kampong D1",
            clubName: "SCHC",
            teamName: "Dames 1",
            knhbMatchId: "knhb-preview-101"
        ),
        MatchListItem(
            id: "preview-knhb-2",
            source: "knhb",
            createdAt: createdAt,
            matchDateTime: thirdMatchDate,
            homeTeam: "Bloemendaal H1",
            awayTeam: "Oranje-Rood H1",
            clubName: "HC Bloemendaal",
            teamName: "Heren 1",
            knhbMatchId: "knhb-preview-102"
        )
    ]

    static let clubs = [
        KNHBOption(id: "club-amsterdam", name: "Amsterdamsche Hockey & Bandy Club", subtitle: nil, abbreviation: "AH&BC"),
        KNHBOption(id: "club-schc", name: "Stichtsche Cricket en Hockey Club", subtitle: nil, abbreviation: "SCHC")
    ]

    static let teams = [
        KNHBOption(id: "team-schc-d1-a", name: "Dames 1", subtitle: "Zondag", abbreviation: nil),
        KNHBOption(id: "team-schc-d1-b", name: "Dames 1", subtitle: "Landelijk", abbreviation: nil),
        KNHBOption(id: "team-schc-d2", name: "Dames 2", subtitle: nil, abbreviation: nil)
    ]

    static let upcomingMatches = [
        KNHBUpcomingMatch(
            id: "knhb-preview-101",
            title: "SCHC D1 - Kampong D1",
            subtitle: "11 January 2026, 14:30",
            dateRaw: "2026-01-11T13:30:00Z"
        ),
        KNHBUpcomingMatch(
            id: "knhb-preview-103",
            title: "Pinoke D1 - SCHC D1",
            subtitle: "18 January 2026, 12:45",
            dateRaw: "2026-01-18T11:45:00Z"
        )
    ]

    static let favorite = KNHBFavoriteTeam(
        id: "club-schc::dames 1",
        clubId: "club-schc",
        clubName: "SCHC",
        name: "Dames 1",
        teamIds: ["team-schc-d1-a", "team-schc-d1-b"]
    )
}
