(function () {
  var mode = "cpu";   // "cpu" or "two"
  var lvl = "hard";   // "easy" or "hard"
  var b, turn, over;
  var sc = { X: 0, O: 0, D: 0 };

  // Background music: a looping melody synthesized in the browser (no audio file needed)
  var musicOn = true;
  var music = (function () {
    var ctx, master, timer, step = 0, nextT = 0;
    var beat = 60 / 96 / 2; // eighth notes at 96 BPM
    var chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
    var pat = [0, 1, 2, 1, 0, 1, 2, 1];
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function tone(f, t, d, type, vol) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    function schedule() {
      while (nextT < ctx.currentTime + 0.3) {
        var ch = chords[Math.floor(step / 8) % 4], i = step % 8;
        tone(hz(ch[pat[i]] + 12), nextT, beat * 1.6, "triangle", 0.5);
        if (i % 4 === 0) tone(hz(ch[0] - 12), nextT, beat * 3.5, "sine", 0.7);
        step++;
        nextT += beat;
      }
    }
    return {
      start: function () {
        try {
          if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            master.gain.value = 0.12;
            master.connect(ctx.destination);
          }
          ctx.resume();
          if (!timer) {
            nextT = ctx.currentTime + 0.05;
            timer = setInterval(schedule, 100);
          }
        } catch (e) {}
      },
      stop: function () {
        if (timer) { clearInterval(timer); timer = null; }
        if (ctx) ctx.suspend();
      }
    };
  })();

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  var $ = function (id) { return document.getElementById(id); };
  var board = $("board");
  var cells = [];

  // Build the 9 squares
  for (var i = 0; i < 9; i++) {
    (function (i) {
      var c = document.createElement("button");
      c.className = "cell";
      c.setAttribute("aria-label", "Square " + (i + 1));
      c.onclick = function () { play(i); };
      board.appendChild(c);
      cells.push(c);
    })(i);
  }

  // Mode / difficulty selector buttons
  function pick(group, attr, fn) {
    var bs = $(group).children;
    for (var k = 0; k < bs.length; k++) {
      bs[k].onclick = function () {
        for (var j = 0; j < bs.length; j++) bs[j].classList.remove("on");
        this.classList.add("on");
        fn(this.getAttribute(attr));
      };
    }
  }
  pick("modes", "data-mode", function (v) {
    mode = v;
    $("levels").style.display = v === "cpu" ? "flex" : "none";
  });
  pick("levels", "data-lvl", function (v) { lvl = v; });

  function winner(s) {
    for (var k = 0; k < LINES.length; k++) {
      var l = LINES[k];
      if (s[l[0]] && s[l[0]] === s[l[1]] && s[l[1]] === s[l[2]]) {
        return { p: s[l[0]], line: l };
      }
    }
    return null;
  }

  function full(s) { return s.every(Boolean); }

  function reset() {
    b = Array(9).fill("");
    turn = "X";
    over = false;
    cells.forEach(function (c) {
      c.textContent = "";
      c.className = "cell";
      c.disabled = false;
    });
    say();
  }

  function say() {
    if (over) return;
    $("status").textContent = mode === "cpu"
      ? (turn === "X" ? "Your turn (X)" : "Computer is thinking…")
      : "Player " + turn + "’s turn";
  }

  function render() {
    cells.forEach(function (c, i) {
      c.textContent = b[i];
      c.className = "cell" + (b[i] ? " " + b[i] : "");
      c.disabled = !!b[i] || over;
    });
  }

  function play(i) {
    if (over || b[i]) return;
    if (mode === "cpu" && turn !== "X") return;
    move(i);
    if (!over && mode === "cpu") {
      setTimeout(function () { if (!over) move(ai()); }, 450);
    }
  }

  function move(i) {
    b[i] = turn;
    var w = winner(b);
    if (w) {
      over = true;
      sc[w.p]++;
      render();
      w.line.forEach(function (k) { cells[k].classList.add("win"); });
      $("status").textContent = mode === "cpu"
        ? (w.p === "X" ? "You win!" : "Computer wins")
        : "Player " + w.p + " wins!";
    } else if (full(b)) {
      over = true;
      sc.D++;
      render();
      $("status").textContent = "It’s a draw";
    } else {
      turn = turn === "X" ? "O" : "X";
      render();
      say();
      return;
    }
    cells.forEach(function (c) { c.disabled = true; });
    scores();
  }

  function scores() {
    $("sx").textContent = sc.X;
    $("so").textContent = sc.O;
    $("sd").textContent = sc.D;
  }

  // Computer player: random moves on Easy (most of the time), minimax on Unbeatable
  function ai() {
    var free = [];
    b.forEach(function (v, i) { if (!v) free.push(i); });
    if (lvl === "easy" && Math.random() < 0.6) {
      return free[Math.floor(Math.random() * free.length)];
    }
    var best = -9, mv = free[0];
    free.forEach(function (i) {
      b[i] = "O";
      var s = minimax(b, false);
      b[i] = "";
      if (s > best) { best = s; mv = i; }
    });
    return mv;
  }

  function minimax(s, isO) {
    var w = winner(s);
    if (w) return w.p === "O" ? 1 : -1;
    if (full(s)) return 0;
    var best = isO ? -9 : 9;
    for (var i = 0; i < 9; i++) {
      if (!s[i]) {
        s[i] = isO ? "O" : "X";
        var v = minimax(s, !isO);
        s[i] = "";
        best = isO ? Math.max(best, v) : Math.min(best, v);
      }
    }
    return best;
  }

  // Buttons
  $("start").onclick = function () {
    if (musicOn) music.start();
    sc = { X: 0, O: 0, D: 0 };
    scores();
    $("nx").textContent = mode === "cpu" ? "You (X)" : "Player X";
    $("no").textContent = mode === "cpu" ? "Computer (O)" : "Player O";
    $("menu").style.display = "none";
    $("game").style.display = "block";
    reset();
  };
  $("again").onclick = reset;
  $("mute").onclick = function () {
    musicOn = !musicOn;
    if (musicOn) music.start(); else music.stop();
    this.textContent = "Music: " + (musicOn ? "on" : "off");
  };
  $("menuBtn").onclick = function () {
    $("game").style.display = "none";
    $("menu").style.display = "block";
  };
})();