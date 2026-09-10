// Musicdata1.js
window.songList = [
    {
        id: "music1",
        title: "Weather Girl",
        artist: "flavor foley",
        scUrl: "https://soundcloud.com/mmjkaito/weathergirl-flavor-foley",
        levels: { easy: "Easy Lv.3", normal: "Normal Lv.6", hard: "Hard Lv.9" },
        charts: {
            easy: [
                {time: 2.0, lane: 0}, {time: 2.5, lane: 1}, {time: 3.0, lane: 2}, {time: 3.5, lane: 3},
                {time: 4.5, lane: 0, isLong: true, endTime: 5.5}, {time: 6.0, lane: 1}, {time: 6.5, lane: 2},
                {time: 7.0, lane: 3}, {time: 8.0, lane: 1, isLong: true, endTime: 9.5}, {time: 10.0, lane: 0}
            ],
            normal: [
                {"time":6,"lane":0,"isLong":true,"endTime":6.5},{"time":6.45,"lane":1},{"time":6.85,"lane":2},{"time":7.15,"lane":3},
                {"time":7.75,"lane":1},{"time":8.05,"lane":0,"isLong":true,"endTime":8.5},{"time":8.55,"lane":2},{"time":8.8,"lane":1},
                {"time":9.2,"lane":3,"isLong":true,"endTime":9.6},{"time":9.65,"lane":0,"isLong":true,"endTime":11.2},{"time":9.9,"lane":1,"isLong":true,"endTime":11.25},
                {"time":11.9,"lane":2},{"time":12.05,"lane":1},{"time":12.4,"lane":3},{"time":12.5,"lane":0,"isLong":true,"endTime":14.4},
                {"time":12.9,"lane":2,"isLong":true,"endTime":13.4},{"time":13.5,"lane":1},{"time":13.9,"lane":3},{"time":14.25,"lane":1},
                {"time":14.5,"lane":2},{"time":14.9,"lane":3},{"time":15.75,"lane":0},{"time":15.75,"lane":3},{"time":17.15,"lane":3},
                {"time":17.45,"lane":1},{"time":17.75,"lane":0},{"time":18.1,"lane":3},{"time":18.25,"lane":1},{"time":18.6,"lane":2},
                {"time":19.1,"lane":3},{"time":19.3,"lane":2},{"time":19.9,"lane":3},{"time":20.1,"lane":2},{"time":20.5,"lane":3},
                {"time":21.85,"lane":0},{"time":22.6,"lane":2},{"time":22.85,"lane":3},{"time":23.2,"lane":1}
            ],
            hard: [
                {time: 1.0, lane: 0}, {time: 1.2, lane: 1}, {time: 1.4, lane: 2}, {time: 1.6, lane: 3},
                {time: 2.0, lane: 2}, {time: 2.2, lane: 1}, {time: 2.4, lane: 0}, {time: 2.6, lane: 3},
                {time: 3.0, lane: 0, isLong: true, endTime: 4.5}, {time: 3.5, lane: 3, isLong: true, endTime: 5.0},
                {time: 5.5, lane: 1}, {time: 5.7, lane: 2}, {time: 5.9, lane: 1}, {time: 6.1, lane: 2}
            ]
        }
    },
];
