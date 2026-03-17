/* ===== Audio Engine (Web Audio API + ファイル音声対応) =====
 *
 * ■ 音声ファイルの配置:
 *   assets/audio/ フォルダに以下のファイルを置く。
 *   存在しない場合は Web Audio API による合成音が自動で使われる。
 *
 *   BGM（ループ再生）:
 *     assets/audio/bgm_title.mp3     … タイトル画面
 *     assets/audio/bgm_dark.mp3      … 本編（第一章など暗い雰囲気）
 *     assets/audio/bgm_tension.mp3   … 本編（第二章など緊迫）
 *     assets/audio/bgm_reveal.mp3    … エンディング / 真相場面
 *
 *   SE（単発再生）:
 *     assets/audio/se_tap.mp3        … テキスト送り
 *     assets/audio/se_choice.mp3     … 選択肢タップ
 *     assets/audio/se_clue.mp3       … 手がかり入手
 *     assets/audio/se_correct.mp3    … パズル正解
 *     assets/audio/se_wrong.mp3      … パズル不正解
 *     assets/audio/se_chapter.mp3    … チャプターカード表示
 *
 *   対応形式: mp3 / ogg / wav（ブラウザ対応に応じて）
 */

const AudioEngine = (() => {
  "use strict";

  let ctx = null;
  let masterGain = null;
  let bgmGain = null;
  let sfxGain = null;

  /* --- State --- */
  let bgmNodes = [];          // 合成BGM用
  let bgmAudioEl = null;      // ファイルBGM用 <audio>
  let currentMood = null;
  let enabled = true;

  /* --- ファイル音声キャッシュ --- */
  const fileCache = {};       // { path: HTMLAudioElement | null }
  const fileAvailable = {};   // { path: boolean }

  /* --- 音声ファイルパス定義 --- */
  const BGM_FILES = {
    title:   "assets/audio/bgm_title.mp3",
    dark:    "assets/audio/bgm_dark.mp3",
    tension: "assets/audio/bgm_tension.mp3",
    reveal:  "assets/audio/bgm_reveal.mp3"
  };

  const SFX_FILES = {
    tap:     "assets/audio/se_tap.mp3",
    choice:  "assets/audio/se_choice.mp3",
    clue:    "assets/audio/se_clue.mp3",
    correct: "assets/audio/se_correct.mp3",
    wrong:   "assets/audio/se_wrong.mp3",
    chapter: "assets/audio/se_chapter.mp3"
  };

  /* --- Mood Definitions (合成フォールバック用) --- */
  const MOODS = {
    title: {
      layers: [
        { freq: 48, type: "sine", vol: 0.09, lfoRate: 0.04, lfoDepth: 5 },
        { freq: 72, type: "sine", vol: 0.06, lfoRate: 0.06, lfoDepth: 8 },
        { freq: 96, type: "triangle", vol: 0.03, lfoRate: 0.09, lfoDepth: 25 }
      ],
      filterBase: 140
    },
    dark: {
      layers: [
        { freq: 55, type: "sine", vol: 0.12, lfoRate: 0.06, lfoDepth: 8 },
        { freq: 82.41, type: "sine", vol: 0.08, lfoRate: 0.08, lfoDepth: 12 },
        { freq: 110, type: "triangle", vol: 0.04, lfoRate: 0.12, lfoDepth: 40 }
      ],
      filterBase: 180
    },
    tension: {
      layers: [
        { freq: 58.27, type: "sine", vol: 0.12, lfoRate: 0.07, lfoDepth: 10 },
        { freq: 82.41, type: "sine", vol: 0.07, lfoRate: 0.1, lfoDepth: 15 },
        { freq: 103.83, type: "triangle", vol: 0.05, lfoRate: 0.15, lfoDepth: 50 }
      ],
      filterBase: 160
    },
    reveal: {
      layers: [
        { freq: 65.41, type: "sine", vol: 0.10, lfoRate: 0.05, lfoDepth: 6 },
        { freq: 98, type: "sine", vol: 0.07, lfoRate: 0.07, lfoDepth: 10 },
        { freq: 130.81, type: "triangle", vol: 0.04, lfoRate: 0.1, lfoDepth: 30 },
        { freq: 164.81, type: "sine", vol: 0.02, lfoRate: 0.13, lfoDepth: 20 }
      ],
      filterBase: 250
    }
  };

  /* --- ファイル存在チェック（プリロード） --- */
  function probeFile(path) {
    return new Promise(function (resolve) {
      if (fileCache[path] !== undefined) {
        resolve(!!fileCache[path]);
        return;
      }
      var audio = new Audio();
      audio.preload = "auto";
      audio.addEventListener("canplaythrough", function () {
        fileCache[path] = audio;
        fileAvailable[path] = true;
        resolve(true);
      }, { once: true });
      audio.addEventListener("error", function () {
        fileCache[path] = null;
        fileAvailable[path] = false;
        resolve(false);
      }, { once: true });
      audio.src = path;
    });
  }

  function preloadAll() {
    var paths = Object.values(BGM_FILES).concat(Object.values(SFX_FILES));
    paths.forEach(function (p) { probeFile(p); });
  }

  /* --- Init --- */
  function init() {
    // ミュート設定をlocalStorageから復元
    try {
      var saved = localStorage.getItem("hageruya_mute");
      if (saved === "true") enabled = false;
    } catch (e) { /* ignore */ }

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = enabled ? 1.0 : 0;
      masterGain.connect(ctx.destination);

      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.5;
      bgmGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.6;
      sfxGain.connect(masterGain);
    } catch (e) {
      /* Web Audio API 非対応環境 */
    }

    preloadAll();
  }

  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem("hageruya_mute", !enabled ? "true" : "false"); } catch (e) { /* ignore */ }
    if (masterGain) masterGain.gain.value = enabled ? 1.0 : 0;
    if (!enabled) {
      stopBGM();
    } else {
      if (ctx && ctx.state === "suspended") ctx.resume();
    }
    return enabled;
  }

  function startBGM(mood) {
    if (!mood) return;
    currentMood = null;
    playBGM(mood);
  }

  function isEnabled() {
    return enabled;
  }

  /* ============================
   *  BGM
   * ============================ */
  function playBGM(mood) {
    if (mood === currentMood) return;

    // フェードアウトしてから切り替え
    stopBGM();
    currentMood = mood;

    if (!enabled) return;

    // ファイル音声を優先
    var filePath = BGM_FILES[mood];
    if (filePath && fileAvailable[filePath] && fileCache[filePath]) {
      playBGMFile(filePath);
    } else {
      playBGMSynth(mood);
    }
  }

  function playBGMFile(path) {
    var audio = fileCache[path];
    if (!audio) return;
    // Clone for fresh playback
    bgmAudioEl = audio.cloneNode();
    bgmAudioEl.loop = true;
    bgmAudioEl.volume = 0;
    bgmAudioEl.play().catch(function () {});
    // Fade in
    fadeBGMAudio(bgmAudioEl, 0, 0.5, 2000);
  }

  function fadeBGMAudio(audio, from, to, duration) {
    audio.volume = from;
    var steps = 30;
    var stepTime = duration / steps;
    var stepVal = (to - from) / steps;
    var current = from;
    var i = 0;
    var timer = setInterval(function () {
      i++;
      current += stepVal;
      if (current < 0) current = 0;
      if (current > 1) current = 1;
      try { audio.volume = current; } catch (e) {}
      if (i >= steps) clearInterval(timer);
    }, stepTime);
    return timer;
  }

  function playBGMSynth(mood) {
    if (!ctx) return;
    var m = MOODS[mood];
    if (!m) return;

    var now = ctx.currentTime;

    m.layers.forEach(function (layer) {
      var osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.value = layer.freq;

      var lfo = ctx.createOscillator();
      lfo.frequency.value = layer.lfoRate;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = layer.lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = m.filterBase;
      filter.Q.value = 0.7;

      var filterLfo = ctx.createOscillator();
      filterLfo.frequency.value = layer.lfoRate * 0.5;
      var filterLfoGain = ctx.createGain();
      filterLfoGain.gain.value = m.filterBase * 0.4;
      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filter.frequency);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(layer.vol, now + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bgmGain);

      osc.start(now);
      lfo.start(now);
      filterLfo.start(now);

      bgmNodes.push({ osc: osc, lfo: lfo, filterLfo: filterLfo, gain: gain });
    });
  }

  function stopBGM() {
    // Stop file-based BGM
    if (bgmAudioEl) {
      var audio = bgmAudioEl;
      fadeBGMAudio(audio, audio.volume, 0, 1200);
      setTimeout(function () {
        try { audio.pause(); audio.currentTime = 0; } catch (e) {}
      }, 1300);
      bgmAudioEl = null;
    }

    // Stop synth-based BGM
    if (ctx) {
      var now = ctx.currentTime;
      bgmNodes.forEach(function (node) {
        try {
          node.gain.gain.linearRampToValueAtTime(0, now + 1.5);
          node.osc.stop(now + 2);
          node.lfo.stop(now + 2);
          node.filterLfo.stop(now + 2);
        } catch (e) { /* already stopped */ }
      });
    }
    bgmNodes = [];
    currentMood = null;
  }

  /* ============================
   *  SFX
   * ============================ */
  function playSFX(type) {
    if (!enabled) return;
    resume();

    // ファイル音声を優先
    var filePath = SFX_FILES[type];
    if (filePath && fileAvailable[filePath] && fileCache[filePath]) {
      playSFXFile(filePath);
      return;
    }

    // 合成フォールバック
    if (!ctx) return;
    var now = ctx.currentTime;
    switch (type) {
      case "tap": sfxTap(now); break;
      case "choice": sfxChoice(now); break;
      case "clue": sfxClue(now); break;
      case "correct": sfxCorrect(now); break;
      case "wrong": sfxWrong(now); break;
      case "chapter": sfxChapter(now); break;
    }
  }

  function playSFXFile(path) {
    var source = fileCache[path];
    if (!source) return;
    var clone = source.cloneNode();
    clone.volume = 0.6;
    clone.play().catch(function () {});
  }

  /* --- 合成 SFX --- */
  function sfxTap(t) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.08);
  }

  function sfxChoice(t) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.08);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  function sfxClue(t) {
    [600, 800, 1000].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      var offset = i * 0.08;
      g.gain.setValueAtTime(0, t + offset);
      g.gain.linearRampToValueAtTime(0.12, t + offset + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.25);
      osc.connect(g); g.connect(sfxGain);
      osc.start(t + offset); osc.stop(t + offset + 0.3);
    });
  }

  function sfxCorrect(t) {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      var offset = i * 0.06;
      g.gain.setValueAtTime(0, t + offset);
      g.gain.linearRampToValueAtTime(0.1, t + offset + 0.05);
      g.gain.linearRampToValueAtTime(0.06, t + offset + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.8);
      osc.connect(g); g.connect(sfxGain);
      osc.start(t + offset); osc.stop(t + offset + 0.9);
    });
  }

  function sfxWrong(t) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.25);
    g.gain.setValueAtTime(0.08, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    osc.connect(filter); filter.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.35);
  }

  function sfxChapter(t) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(130, t + 0.8);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.3);
    g.gain.linearRampToValueAtTime(0.1, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 250;
    osc.connect(filter); filter.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 1.6);

    var osc2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 160;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc2.connect(g2); g2.connect(sfxGain);
    osc2.start(t); osc2.stop(t + 1.6);
  }

  /* ============================
   *  Visibility Recovery
   *  スマホでアプリ切り替え → 復帰時にBGMを再開する
   * ============================ */
  var resumeDebounce = 0;

  function handleVisibilityResume() {
    // 連続発火を防止（visibilitychange + focus が同時に来る場合がある）
    var now = Date.now();
    if (now - resumeDebounce < 500) return;
    resumeDebounce = now;

    // ミュート中は何もしない
    if (!enabled) return;

    // AudioContext を再開（合成BGM・SFX用）
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }

    // ファイルBGMが一時停止されていたら再開
    if (bgmAudioEl && bgmAudioEl.paused && currentMood) {
      bgmAudioEl.play().catch(function () {});
    }
  }

  // メインイベント：ページが再表示された時
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      handleVisibilityResume();
    }
  });

  // Safari: bfcache からの復帰
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) handleVisibilityResume();
  });

  // 一部モバイルブラウザ向けの補助
  window.addEventListener("focus", handleVisibilityResume);

  return { init, resume, toggle, isEnabled, playBGM, startBGM, stopBGM, playSFX };
})();
