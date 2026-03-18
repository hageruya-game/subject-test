/* ===== Game Engine ===== */

(function () {
  "use strict";

  /* ---------- State ---------- */
  function createInitialState() {
    return {
      currentScene: "prologue",
      flags: {},           // シーン到達フラグ
      clues: [],           // 手がかり [{id, text}]
      choices: {},         // 選択履歴 {choiceId: selectedNext}
      solvedPuzzles: [],   // 解決済みパズルID
      endingFlags: {},     // エンディング条件（将来拡張用）
      suspicionLevel: 0,  // 疑惑レベル (0〜5)
      suspicionFlags: {}, // 疑惑関連フラグ
      insight: 5,         // 洞察レベル (0〜5, CASE_01用)
      memoryFragments: [], // 記憶の断片 [{id, text, chapter}]
      memo: "",
      hintIndex: 0,
      playerName: "",
      c1Profile: null,
      tracker: {
        startTime: 0,
        sceneCount: 0,
        optionalScenes: 0,
        hintCount: 0,
        clueCheckCount: 0,
        saveCount: 0,
        memoLength: 0,
        puzzleFailCount: 0,
        choiceTimestamps: [],
        accusedSuspect: ""
      }
    };
  }

  let state = createInitialState();

  let textQueue = [];
  let textIndex = 0;
  let charIndex = 0;
  let isTyping = false;
  let backlog = [];
  let typeTimer = null;
  var textDelayTimer = null;
  const TYPE_SPEED = 30;
  const TYPE_SPEED_VAR = 15;
  let audioInitialized = false;
  let puzzleHintIndex = 0;
  var choiceShownTime = 0;
  var userScrolled = false;
  var OPTIONAL_SCENES = ["kitchen", "kenta_kitchen"];

  /* ---------- Scene History (戻るボタン用) ---------- */
  var sceneHistory = [];
  var lastSceneSnapshot = null;
  var MAX_HISTORY = 20;
  var sceneTransitioning = false; // シーン遷移中のタップ抑止フラグ

  /* ---------- Case switching ---------- */
  var activeStory = STORY;
  var casePrefix = "hageruya_";
  var currentCase = 1;
  var justClearedCase1 = false; // CASE_01初クリア直後フラグ

  function isMirror() {
    return !activeStory.suspects || activeStory.suspects.length === 0;
  }

  function switchToCase(caseNum) {
    if (caseNum === 2 && typeof STORY_C2 !== "undefined") {
      activeStory = STORY_C2;
      casePrefix = "hageruya_c2_";
      currentCase = 2;
      document.title = "SUBJECT | CASE_02";
    } else {
      activeStory = STORY;
      casePrefix = "hageruya_";
      currentCase = 1;
      document.title = isMirror() ? "SUBJECT: MIRROR" : "SUBJECT | CASE_01";
    }
  }

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const screens = {
    title: $("title-screen"),
    chapter: $("chapter-card"),
    game: $("game-screen"),
    ending: $("ending-screen")
  };
  const els = {
    chapterLabel: $("chapter-label"),
    speaker: $("speaker-name"),
    text: $("game-text"),
    tap: $("tap-indicator"),
    choices: $("choices-container"),
    puzzle: $("puzzle-container"),
    puzzleQ: $("puzzle-question"),
    puzzleInput: $("puzzle-input"),
    puzzleFeedback: $("puzzle-feedback"),
    puzzleHintBtn: $("puzzle-hint-btn"),
    puzzleHintArea: $("puzzle-hint-area"),
    evidence: $("evidence-container"),
    evidenceInstruction: $("evidence-instruction"),
    evidenceSelected: $("evidence-selected"),
    evidenceCandidates: $("evidence-candidates"),
    evidenceFeedback: $("evidence-feedback"),
    saveSlots: $("save-slots"),
    cluesList: $("clues-list"),
    hintContent: $("hint-content"),
    memoArea: $("memo-textarea"),
    notification: $("notification"),
    notifText: $("notification-text"),
    endingText: $("ending-text"),
    endingBanner: $("ending-banner"),
    endingSubtitle: $("ending-subtitle"),
    chapterNum: $("chapter-card-number"),
    chapterTitle: $("chapter-card-title"),
    soundToggle: $("sound-toggle"),
    titleSoundToggle: $("title-sound-toggle"),
    btnContinueInfo: $("btn-continue-info"),
    titleClearRecord: $("title-clear-record"),
    confirmDialog: $("confirm-dialog"),
    confirmText: $("confirm-text"),
    confirmYes: $("confirm-yes"),
    confirmNo: $("confirm-no"),
    sceneFlash: $("scene-flash"),
    particlesCanvas: $("particles-canvas")
  };

  /* ---------- State helpers ---------- */
  function hasClue(id) {
    return state.clues.some(function (c) {
      return (typeof c === "string") ? c === id : c.id === id;
    });
  }

  function getClueText(clue) {
    return (typeof clue === "string") ? clue : clue.text;
  }

  function hasMemory(id) {
    return state.memoryFragments.some(function (m) { return m.id === id; });
  }

  function getMemoryText(memory) {
    return (typeof memory === "string") ? memory : memory.text;
  }

  function adjustSuspicion(delta) {
    var prev = state.suspicionLevel;
    state.suspicionLevel = Math.max(0, Math.min(5, state.suspicionLevel + delta));
    if (state.suspicionLevel !== prev) {
      updateSuspicionIndicator();
      if (delta > 0) {
        notifyStyled("何かが引っかかる…", "suspicion");
      }
    }
  }

  function updateSuspicionIndicator() {
    var el = $("suspicion-indicator");
    if (!el) return;
    if (state.suspicionLevel > 0) {
      var dots = "";
      for (var i = 0; i < state.suspicionLevel; i++) dots += "◈";
      el.textContent = "違和感 " + dots;
      el.classList.add("visible");
    } else {
      el.classList.remove("visible");
    }
  }

  function updateInsightIndicator() {
    var el = $("insight-indicator");
    if (!el) return;
    if (currentCase !== 1 && currentCase !== 2) { el.classList.remove("visible"); return; }
    var diamonds = "";
    for (var i = 0; i < 5; i++) {
      diamonds += i < state.insight ? "◆" : "◇";
    }
    var label = currentCase === 2 ? "適性" : "洞察";
    el.textContent = label + " " + diamonds;
    el.classList.add("visible");
    if (state.insight <= 2) {
      el.classList.add("insight-low");
    } else {
      el.classList.remove("insight-low");
    }
  }

  function notifyStyled(msg, style) {
    els.notifText.textContent = msg;
    els.notification.className = "notification" + (style ? " " + style : "");
    els.notification.classList.add("visible");
    clearTimeout(notifTimer);
    notifTimer = setTimeout(function () {
      els.notification.classList.remove("visible");
      setTimeout(function () { els.notification.className = "notification"; }, 400);
    }, 2200);
  }

  /* ---------- Condition checker ---------- */
  function checkCondition(cond) {
    if (!cond) return true;
    return cond.split("&&").every(function (part) {
      var p = part.trim();
      if (p.startsWith("!clue:"))      return !hasClue(p.slice(6));
      if (p.startsWith("clue:"))       return hasClue(p.slice(5));
      if (p.startsWith("!choice:"))    return !state.choices[p.slice(8)];
      if (p.startsWith("choice:"))     return !!state.choices[p.slice(7)];
      if (p.startsWith("!suspicion:")) return state.suspicionLevel < parseInt(p.slice(11), 10);
      if (p.startsWith("suspicion:"))  return state.suspicionLevel >= parseInt(p.slice(10), 10);
      if (p.startsWith("!memory:"))    return !hasMemory(p.slice(8));
      if (p.startsWith("memory:"))     return hasMemory(p.slice(7));
      if (p.startsWith("c1_type:"))    return state.c1Profile && state.c1Profile.playerType === p.slice(8);
      if (p.startsWith("c1_ending:"))  return state.c1Profile && state.c1Profile.endingType === p.slice(10);
      if (p.startsWith("insight:"))    return state.insight >= parseInt(p.slice(8), 10);
      if (p.startsWith("!"))           return !state.flags[p.slice(1)];
      return !!state.flags[p];
    });
  }

  /* ---------- Particles ---------- */
  const particles = [];
  let pCtx = null;

  function initParticles() {
    const canvas = els.particlesCanvas;
    if (!canvas) return;
    pCtx = canvas.getContext("2d");
    resizeCanvas();
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.8 + 0.4,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: -(Math.random() * 0.25 + 0.05),
        opacity: Math.random() * 0.25 + 0.05,
        opacityDir: Math.random() > 0.5 ? 1 : -1
      });
    }
    animateParticles();
  }

  function resizeCanvas() {
    const canvas = els.particlesCanvas;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function animateParticles() {
    if (!pCtx) return;
    const canvas = els.particlesCanvas;
    pCtx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function (p) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.opacity += p.opacityDir * 0.001;
      if (p.opacity > 0.3) p.opacityDir = -1;
      if (p.opacity < 0.03) p.opacityDir = 1;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      pCtx.fillStyle = "rgba(201,169,110," + p.opacity + ")";
      pCtx.fill();
    });
    requestAnimationFrame(animateParticles);
  }

  /* ---------- Screen management ---------- */
  function showScreen(name) {
    trace("showScreen", name);
    Object.values(screens).forEach(function (s) { s.classList.remove("active"); });
    screens[name].classList.add("active");
  }

  /* ---------- Scene transition flash ---------- */
  function flashTransition(callback) {
    trace("flashTransition START");
    sceneTransitioning = true;
    els.sceneFlash.classList.add("active");
    setTimeout(function () {
      callback();
      setTimeout(function () {
        els.sceneFlash.classList.remove("active");
        sceneTransitioning = false;
        trace("flashTransition END, transitioning=false");
      }, 80);
    }, 250);
  }

  /* ---------- Notifications ---------- */
  let notifTimer = null;
  function notify(msg) {
    els.notifText.textContent = msg;
    els.notification.classList.add("visible");
    clearTimeout(notifTimer);
    notifTimer = setTimeout(function () { els.notification.classList.remove("visible"); }, 2200);
  }

  /* ---------- Audio helpers ---------- */
  function ensureAudio() {
    if (!audioInitialized) {
      AudioEngine.init();
      audioInitialized = true;
    }
    AudioEngine.resume();
  }

  function syncSoundIcons() {
    var on = AudioEngine.isEnabled();
    var icon = on ? "🔊" : "🔇";
    if (els.soundToggle) els.soundToggle.textContent = icon;
    if (els.titleSoundToggle) els.titleSoundToggle.textContent = icon;
  }

  function handleSoundToggle(e) {
    e.stopPropagation();
    ensureAudio();
    AudioEngine.toggle();
    syncSoundIcons();
    var on = AudioEngine.isEnabled();
    notify(on ? "サウンド ON" : "サウンド OFF");
    // 音声ON時、現在の画面に応じてBGMを再開
    if (on) {
      if (screens.title.classList.contains("active")) {
        if (!isMirror()) AudioEngine.startBGM("title");
      } else if (screens.game.classList.contains("active")) {
        var scene = activeStory.scenes[state.currentScene];
        if (scene) { var bgm = getBGMForChapter(scene.chapter); if (bgm) AudioEngine.startBGM(bgm); }
      }
    }
  }

  function getBGMForChapter(chapterId) {
    if (isMirror() && chapterId <= 1) return null;
    if (chapterId <= 1) return "dark";
    return "tension";
  }

  /* ---------- Chapter card ---------- */
  function showChapterCard(chapterIndex, callback) {
    const ch = activeStory.chapters[chapterIndex];
    if (!ch) { callback(); return; }
    els.chapterNum.textContent = ch.label;
    els.chapterTitle.textContent = ch.title;
    var content = document.querySelector(".chapter-card-content");
    content.style.display = "none";
    void content.offsetHeight;
    content.style.display = "";
    showScreen("chapter");
    AudioEngine.playSFX("chapter");
    var chBgm = getBGMForChapter(chapterIndex); if (chBgm) AudioEngine.playBGM(chBgm);
    setTimeout(function () {
      showScreen("game");
      callback();
    }, 2400);
  }

  /* ---------- #041 Warning ---------- */
  var warningTimers = [];

  function show041Warning(callback) {
    var overlay = $("warning-041-overlay");
    var linesEl = $("warning-041-lines");
    if (!overlay || !linesEl) { callback(); return; }

    warningTimers.forEach(clearTimeout);
    warningTimers = [];
    linesEl.innerHTML = "";
    overlay.classList.add("active");
    var warningDone = false;

    function finishWarning() {
      if (warningDone) return;
      warningDone = true;
      overlay.removeEventListener("click", skipHandler);
      overlay.classList.remove("active");
      warningTimers.forEach(clearTimeout);
      warningTimers = [];
      linesEl.innerHTML = "";
      setTimeout(callback, 400);
    }

    // 5秒後にタップスキップ解禁
    function skipHandler() { finishWarning(); }
    warningTimers.push(setTimeout(function () {
      overlay.addEventListener("click", skipHandler);
      var skipHint = document.createElement("div");
      skipHint.className = "warning-041-skip";
      skipHint.textContent = "タップでスキップ";
      linesEl.appendChild(skipHint);
    }, 5000));

    var lines = [
      { text: "> SUBJECT FILE #041 ── ACCESS DENIED", delay: 500 },
      { text: "> WARNING: LOG INTEGRITY COMPROMISED", delay: 2000 },
      { text: "> ……お前は、被験者だ。", delay: 4000 },
      { text: "> お前が解いている事件は──", delay: 6500 },
      { text: "> 作られた事件だ。", delay: 8500 }
    ];

    lines.forEach(function (lineData) {
      warningTimers.push(setTimeout(function () {
        var div = document.createElement("div");
        div.className = "warning-041-line";
        linesEl.appendChild(div);
        var i = 0;
        function typeW() {
          if (i < lineData.text.length) {
            div.textContent += lineData.text[i];
            i++;
            warningTimers.push(setTimeout(typeW, 35));
          }
        }
        typeW();
      }, lineData.delay));
    });

    // 自動終了（12秒）
    warningTimers.push(setTimeout(finishWarning, 12000));
  }

  /* ---------- Debug trace (CASE_02調査用・修正後に削除) ---------- */
  var C2_TRACE = true;
  var traceEl = null;
  var traceLines = [];
  function trace() {
    if (!C2_TRACE || currentCase !== 2) return;
    var msg = Array.prototype.slice.call(arguments).join(" ");
    console.log("[C2]", msg);
    // 画面上にも表示（スマホデバッグ用）
    traceLines.push(msg);
    if (traceLines.length > 8) traceLines.shift();
    if (!traceEl) {
      traceEl = document.createElement("div");
      traceEl.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:#0f0;font:10px monospace;padding:4px;z-index:99999;pointer-events:none;white-space:pre-wrap;max-height:30vh;overflow:hidden;";
      document.body.appendChild(traceEl);
    }
    traceEl.textContent = traceLines.join("\n");
  }

  /* ---------- Scene rendering ---------- */
  function goToScene(sceneId, useFlash) {
    trace("goToScene", sceneId, "flash=" + !!useFlash, "prevScene=" + state.currentScene, "transitioning=" + sceneTransitioning);
    // CASE_02: ゲームオーバーからの再スタート
    if (sceneId === "c2_restart_trigger") {
      var pName = state.playerName;
      state = createInitialState();
      state.playerName = pName;
      state.tracker.startTime = Date.now();
      try {
        var raw = localStorage.getItem("hageruya_c1_profile");
        if (raw) state.c1Profile = JSON.parse(raw);
      } catch (e) { /* ignore */ }
      updateInsightIndicator();
      updateSuspicionIndicator();
      goToScene("c2_intro");
      return;
    }
    var doGo = function () {
      var scene = activeStory.scenes[sceneId];
      if (!scene) { sceneTransitioning = false; return; }

      // 前シーンのスナップショットを履歴に積む
      if (lastSceneSnapshot) {
        sceneHistory.push(lastSceneSnapshot);
        if (sceneHistory.length > MAX_HISTORY) sceneHistory.shift();
        lastSceneSnapshot = null;
      }
      updateBackButton();

      // #041 Warning 演出
      if (sceneId === "c2_041_warning") {
        state.currentScene = sceneId;
        if (scene.flag) state.flags[scene.flag] = true;
        autoSave();
        show041Warning(function () {
          var nextScene = scene.next;
          if (nextScene) goToScene(nextScene, true);
        });
        return;
      }

      state.currentScene = sceneId;
      state.hintIndex = 0;

      // Tracker
      if (state.tracker) {
        state.tracker.sceneCount++;
        if (OPTIONAL_SCENES.some(function (s) { return sceneId.indexOf(s) !== -1; })) {
          state.tracker.optionalScenes++;
        }
      }

      // Set flag
      if (scene.flag) state.flags[scene.flag] = true;

      // Adjust suspicion
      if (typeof scene.suspicion === "number") {
        adjustSuspicion(scene.suspicion);
      }

      // Collect memory fragment
      if (scene.memory) {
        if (!hasMemory(scene.memory.id)) {
          state.memoryFragments.push(scene.memory);
          setTimeout(function () {
            notifyStyled("記憶の断片を入手した…", "memory");
          }, 800);
        }
      }

      // NPC suspicion narration
      if (scene.npcSuspicion) {
        setTimeout(function () {
          notifyStyled(scene.npcSuspicion, "suspicion");
        }, 1200);
      }

      // Update indicators
      updateSuspicionIndicator();
      updateInsightIndicator();

      // Collect clue
      if (scene.clue) {
        var clueObj = (typeof scene.clue === "string")
          ? { id: scene.clue, text: scene.clue }
          : scene.clue;
        if (!hasClue(clueObj.id)) {
          state.clues.push(clueObj);
          setTimeout(function () {
            notify("手がかりを入手した");
            AudioEngine.playSFX("clue");
          }, 500);
        }
      }

      // Auto-save
      autoSave();

      // シーン進入後のスナップショットを取得（選択肢/パズル変更前の状態）
      lastSceneSnapshot = {
        sceneId: sceneId,
        state: JSON.parse(JSON.stringify(state)),
        backlog: backlog.slice()
      };

      // Ending（エンディングはスナップショット不要）
      if (scene.isEnding) {
        lastSceneSnapshot = null;
        showEnding(scene.endingType || "normal");
        return;
      }

      // CASE_01: epilogue_true の最終行を洞察レベルで差し替え
      if (currentCase === 1 && sceneId === "epilogue_true" && scene.text && scene.text.length > 0) {
        scene = JSON.parse(JSON.stringify(scene)); // 元データを壊さないようコピー
        var lastIdx = scene.text.length - 1;
        if (state.insight >= 5) {
          scene.text[lastIdx] = "──すべてを見通した、という確信があった。";
        } else if (state.insight <= 2) {
          scene.text[lastIdx] = "──本当にこれで正しかったのか。答えは、まだ揺れている。";
        }
        // 3-4 はデフォルトテキストのまま
      }

      // Meta interrupt check
      if (scene.meta && !state.flags["_meta_" + sceneId]) {
        state.flags["_meta_" + sceneId] = true;
        showMetaInterrupt(scene.meta, function () {
          renderScene(scene, sceneId);
        });
        return;
      }

      renderScene(scene, sceneId);
    };

    if (useFlash) {
      flashTransition(doGo);
    } else {
      doGo();
    }
  }

  /* ---------- 戻るボタン ---------- */
  function goBack() {
    if (sceneHistory.length === 0) return;
    var snapshot = sceneHistory.pop();

    // state復元
    state = JSON.parse(JSON.stringify(snapshot.state));
    backlog = snapshot.backlog.slice();

    // UI復元（goToSceneを通さないのでautoSaveは走らない）
    closeAllModals();
    updateSuspicionIndicator();
    updateInsightIndicator();
    updateBackButton();

    // シーン再描画（チャプターカード演出はスキップ）
    var scene = activeStory.scenes[snapshot.sceneId];
    if (!scene) return;

    // 戻り先のスナップショットを保持（さらに戻れるように）
    lastSceneSnapshot = {
      sceneId: snapshot.sceneId,
      state: JSON.parse(JSON.stringify(state)),
      backlog: backlog.slice()
    };

    renderScene(scene, snapshot.sceneId, true);
  }

  function updateBackButton() {
    var btn = $("btn-back");
    if (!btn) return;
    btn.disabled = sceneHistory.length === 0;
  }

  function clearSceneHistory() {
    sceneHistory = [];
    lastSceneSnapshot = null;
    updateBackButton();
  }

  /* ---------- テキストグルーピング（段落単位表示） ---------- */
  function groupTextQueue(queue) {
    var MAX_NARRATION = 4;
    var MAX_DIALOGUE = 5;
    var result = [];
    var i = 0;

    function parseLine(raw) {
      if (raw.startsWith("{")) {
        var end = raw.indexOf("}");
        return { speaker: raw.substring(1, end), content: raw.substring(end + 1) };
      }
      return { speaker: null, content: raw };
    }

    while (i < queue.length) {
      var parsed = parseLine(queue[i]);

      if (parsed.speaker) {
        var contents = [parsed.content];
        var j = i + 1;
        while (j < queue.length && contents.length < MAX_DIALOGUE) {
          var next = parseLine(queue[j]);
          if (next.speaker === parsed.speaker) {
            contents.push(next.content);
            j++;
          } else { break; }
        }
        result.push("{" + parsed.speaker + "}" + contents.join("\n"));
        i = j;
      } else {
        var contents = [parsed.content];
        var j = i + 1;
        while (j < queue.length && contents.length < MAX_NARRATION) {
          var next = parseLine(queue[j]);
          if (!next.speaker) {
            contents.push(next.content);
            j++;
          } else { break; }
        }
        result.push(contents.join("\n"));
        i = j;
      }
    }
    return result;
  }

  function renderScene(scene, sceneId, skipChapterCard) {
    trace("renderScene", sceneId, "textDelay=" + scene.textDelay, "showChapter=" + !!scene.showChapter, "textLen=" + (scene.text ? scene.text.length : 0));
    // Chapter label
    var chLabel = activeStory.chapters[scene.chapter];
    els.chapterLabel.textContent = chLabel ? chLabel.label + "　" + chLabel.title : "";

    // BGM
    var sceneBgm = getBGMForChapter(scene.chapter);
    if (sceneBgm) AudioEngine.playBGM(sceneBgm);

    // Hide interactive elements
    els.choices.classList.remove("visible");
    els.puzzle.classList.remove("visible");
    els.evidence.classList.remove("visible");
    els.tap.classList.remove("visible");

    // Prepare text ({name} → プレイヤー名に置換 → 段落グルーピング)
    var pName = state.playerName || "探偵";
    textQueue = scene.text.slice().map(function (line) {
      return line.replace(/\{name\}/g, pName);
    });
    if (!scene.textDelay) {
      textQueue = groupTextQueue(textQueue);
    }
    textIndex = 0;
    els.text.innerHTML = "";
    clearTimeout(typeTimer);
    isTyping = false;
    clearTimeout(textDelayTimer);
    textDelayTimer = null;
    trace("textQueue ready", "len=" + textQueue.length, "first=" + (textQueue[0] || "").substring(0, 30));

    if (scene.showChapter && !skipChapterCard) {
      showChapterCard(scene.chapter, function () {
        showScreen("game");
        showNextParagraph();
      });
    } else {
      showScreen("game");
      if (scene.textDelay > 0) {
        textDelayTimer = setTimeout(showNextParagraph, scene.textDelay);
      } else {
        showNextParagraph();
      }
    }

  }

  /* ---------- Meta Narrative Interrupt ---------- */
  function showMetaInterrupt(meta, callback) {
    var overlay = $("meta-overlay");
    var textEl = $("meta-text");
    if (!overlay || !textEl) { callback(); return; }

    var now = new Date();
    var timeStr = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
    var line = meta.text
      .replace(/\{name\}/g, state.playerName || "探偵")
      .replace(/\{time\}/g, timeStr);

    textEl.textContent = "";
    overlay.classList.add("active");

    setTimeout(function () {
      typeMetaText(textEl, line, 50, function () {
        setTimeout(function () {
          overlay.classList.remove("active");
          setTimeout(callback, 300);
        }, 2500);
      });
    }, 800);
  }

  function typeMetaText(el, text, speed, callback) {
    var i = 0;
    function tick() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        setTimeout(tick, speed);
      } else if (callback) {
        callback();
      }
    }
    tick();
  }

  /* ---------- Text display ---------- */
  function showNextParagraph() {
    textDelayTimer = null;
    userScrolled = false;
    trace("showNextParagraph", "scene=" + state.currentScene, "textIndex=" + textIndex, "queueLen=" + textQueue.length);
    if (textIndex >= textQueue.length) {
      onTextComplete();
      return;
    }

    var raw = textQueue[textIndex];
    var speaker = null;
    var content = raw;

    if (raw.startsWith("{")) {
      var end = raw.indexOf("}");
      speaker = raw.substring(1, end);
      content = raw.substring(end + 1);
    }

    // バックログに蓄積（グループ内の各行を個別に記録、最大50件）
    var lines = content.split("\n");
    lines.forEach(function (line) {
      backlog.push({ speaker: speaker, text: line });
    });
    if (backlog.length > 50) backlog.splice(0, backlog.length - 50);

    if (speaker) {
      els.speaker.textContent = speaker;
      els.speaker.classList.add("visible");
    } else {
      els.speaker.classList.remove("visible");
      setTimeout(function () {
        if (!els.speaker.classList.contains("visible")) els.speaker.textContent = "";
      }, 350);
    }

    var existing = els.text.querySelector(".current-text");
    if (existing) {
      existing.classList.remove("current-text", "typing-cursor");
      existing.classList.add("history-text");
    }

    var span = document.createElement("span");
    span.className = "current-text typing-cursor";
    els.text.appendChild(span);

    isTyping = true;
    charIndex = 0;
    els.tap.classList.remove("visible");

    function typeChar() {
      if (charIndex < content.length) {
        span.textContent += content[charIndex];
        charIndex++;
        if (!userScrolled) {
          var container = $("text-container");
          container.scrollTop = container.scrollHeight;
        }
        var ch = content[charIndex - 1];
        var delay = TYPE_SPEED + Math.random() * TYPE_SPEED_VAR;
        if (ch === "\n") delay += 150;
        else if ("。、！？…──」』".includes(ch)) delay += 80;
        else if ("、,".includes(ch)) delay += 40;
        typeTimer = setTimeout(typeChar, delay);
      } else {
        isTyping = false;
        span.classList.remove("typing-cursor");
        // textDelay シーン: 最終行以外は自動送り（タップ不要）
        var delayScene = activeStory.scenes[state.currentScene];
        if (delayScene && delayScene.textDelay > 0 && textIndex < textQueue.length - 1) {
          textIndex++;
          textDelayTimer = setTimeout(showNextParagraph, delayScene.textDelay);
        } else {
          els.tap.classList.add("visible");
        }
      }
    }

    clearTimeout(typeTimer);
    typeChar();
  }

  function skipTypewriter() {
    if (!isTyping) return;
    clearTimeout(typeTimer);
    var raw = textQueue[textIndex];
    var content = raw;
    if (raw.startsWith("{")) content = raw.substring(raw.indexOf("}") + 1);
    var span = els.text.querySelector(".current-text");
    if (span) {
      span.textContent = content;
      span.classList.remove("typing-cursor");
    }
    isTyping = false;
    // textDelay シーン: スキップ後も自動送り
    var delayScene = activeStory.scenes[state.currentScene];
    if (delayScene && delayScene.textDelay > 0 && textIndex < textQueue.length - 1) {
      textIndex++;
      textDelayTimer = setTimeout(showNextParagraph, delayScene.textDelay);
    } else {
      els.tap.classList.add("visible");
    }
  }

  function advanceText() {
    trace("advanceText", "scene=" + state.currentScene, "textIndex=" + textIndex, "queueLen=" + textQueue.length, "isTyping=" + isTyping, "hasDelayTimer=" + !!textDelayTimer);
    if (textDelayTimer) {
      clearTimeout(textDelayTimer);
      textDelayTimer = null;
      showNextParagraph();
      return;
    }
    if (isTyping) { skipTypewriter(); return; }
    AudioEngine.playSFX("tap");
    textIndex++;
    showNextParagraph();
  }

  /* ---------- After all text shown ---------- */
  function hasVisibleChoices(scene) {
    return scene.choices && scene.choices.some(function (c) { return checkCondition(c.condition); });
  }

  function resolveNext(scene) {
    if (scene.nextConditions) {
      for (var i = 0; i < scene.nextConditions.length; i++) {
        var nc = scene.nextConditions[i];
        if (!nc.condition || checkCondition(nc.condition)) return nc.next;
      }
    }
    return scene.next;
  }

  function onTextComplete() {
    els.tap.classList.remove("visible");
    var scene = activeStory.scenes[state.currentScene];
    trace("onTextComplete", "scene=" + state.currentScene, "next=" + resolveNext(scene), "hasChoices=" + hasVisibleChoices(scene), "hasQuiz=" + !!scene.quiz);

    if (hasVisibleChoices(scene)) {
      showChoices(scene.choices);
    } else if (scene.quiz) {
      showQuiz(scene.quiz);
    } else if (scene.puzzle) {
      showPuzzle(scene.puzzle);
    } else if (scene.evidencePuzzle) {
      showEvidencePuzzle(scene.evidencePuzzle);
    } else {
      var nextScene = resolveNext(scene);
      if (nextScene) {
        goToScene(nextScene, true);
      }
    }
  }

  /* ---------- Quiz (3択クイズ：不正解→即リトライ) ---------- */
  function showQuiz(quiz) {
    els.choices.innerHTML = "";
    var locked = false;

    quiz.options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt.text;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (locked) return;
        var fb = els.choices.querySelector(".quiz-feedback");

        if (opt.correct) {
          locked = true;
          AudioEngine.playSFX("correct");
          btn.classList.add("selected");
          els.choices.querySelectorAll(".choice-btn").forEach(function (b) {
            if (b !== btn) b.style.opacity = "0.3";
          });
          if (fb) fb.remove();
          if (quiz.successText) {
            var sfb = document.createElement("div");
            sfb.className = "quiz-feedback quiz-feedback-success";
            sfb.textContent = quiz.successText;
            els.choices.appendChild(sfb);
          }
          setTimeout(function () {
            els.choices.classList.remove("visible");
            goToScene(quiz.successNext, true);
          }, 1500);
        } else {
          locked = true;
          AudioEngine.playSFX("wrong");
          btn.classList.add("quiz-wrong");
          if (state.tracker) state.tracker.puzzleFailCount++;
          if (state.insight > 0) {
            state.insight--;
            updateInsightIndicator();
          }
          if (fb) fb.remove();
          var nfb = document.createElement("div");
          nfb.className = "quiz-feedback quiz-feedback-fail";
          // CASE_02: 適性値0でゲームオーバー
          if (currentCase === 2 && state.insight <= 0) {
            nfb.textContent = "適性値が基準を下回りました。";
            els.choices.appendChild(nfb);
            setTimeout(function () {
              els.choices.classList.remove("visible");
              goToScene("c2_gameover", true);
            }, 1500);
            return;
          }
          nfb.textContent = quiz.failText;
          els.choices.appendChild(nfb);
          setTimeout(function () {
            btn.classList.remove("quiz-wrong");
            if (nfb.parentNode) {
              nfb.classList.add("quiz-feedback-out");
              setTimeout(function () { if (nfb.parentNode) nfb.remove(); }, 300);
            }
            locked = false;
          }, 1200);
        }
      });
      els.choices.appendChild(btn);
    });

    els.choices.classList.add("visible");
  }

  /* ---------- Choices ---------- */
  function showChoices(choices) {
    els.choices.innerHTML = "";
    choiceShownTime = Date.now();
    var locked = false;
    var filtered = choices.filter(function (c) { return checkCondition(c.condition); });

    filtered.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = choice.text;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (locked) return;
        locked = true;

        // Track choice timing
        if (state.tracker && choiceShownTime) {
          state.tracker.choiceTimestamps.push(Date.now() - choiceShownTime);
        }

        // Track choice
        if (choice.choiceId) {
          state.choices[choice.choiceId] = choice.next;
        }

        // Selection animation
        AudioEngine.playSFX("choice");
        btn.classList.add("selected");
        els.choices.querySelectorAll(".choice-btn").forEach(function (b) {
          if (b !== btn) b.style.opacity = "0.3";
        });

        setTimeout(function () { goToScene(choice.next, true); }, 350);
      });
      els.choices.appendChild(btn);
    });

    els.choices.classList.add("visible");
  }

  /* ---------- Puzzle ---------- */
  function showPuzzle(puzzle) {
    els.puzzleQ.textContent = puzzle.question;
    els.puzzleInput.value = "";
    els.puzzleFeedback.textContent = "";
    els.puzzleFeedback.className = "";
    els.puzzleInput.classList.remove("puzzle-shake", "puzzle-success", "puzzle-fail");
    els.puzzle.classList.remove("visible");

    // Reset inline hints
    puzzleHintIndex = 0;
    els.puzzleHintArea.innerHTML = "";
    var scene = activeStory.scenes[state.currentScene];
    var hasHints = scene && scene.hints && scene.hints.length > 0;
    els.puzzleHintBtn.style.display = hasHints ? "" : "none";

    void els.puzzle.offsetHeight;
    els.puzzle.classList.add("visible");
    setTimeout(function () { els.puzzleInput.focus(); }, 500);
  }

  function submitPuzzle() {
    var scene = activeStory.scenes[state.currentScene];
    if (!scene || !scene.puzzle) return;
    var puzzle = scene.puzzle;
    var answer = els.puzzleInput.value.trim();

    if (!answer) return;

    var normalizedAnswer = answer.toUpperCase();
    var isCorrect = puzzle.answers.some(function (a) { return a.toUpperCase() === normalizedAnswer; });
    if (isCorrect) {
      // Track solved puzzle
      if (puzzle.id && !state.solvedPuzzles.includes(puzzle.id)) {
        state.solvedPuzzles.push(puzzle.id);
      }

      AudioEngine.playSFX("correct");
      els.puzzleInput.classList.add("puzzle-success");
      els.puzzleInput.disabled = true;
      els.puzzleFeedback.textContent = "── 正解だ。";
      els.puzzleFeedback.classList.add("success");
      els.puzzleHintBtn.style.display = "none";

      setTimeout(function () {
        els.puzzle.classList.remove("visible");
        els.puzzleInput.classList.remove("puzzle-success");
        els.puzzleInput.disabled = false;
        els.puzzleFeedback.className = "";

        // Determine next scene via conditions or direct successNext
        var nextScene = null;
        if (puzzle.successConditions) {
          for (var i = 0; i < puzzle.successConditions.length; i++) {
            var sc = puzzle.successConditions[i];
            if (!sc.condition || checkCondition(sc.condition)) {
              nextScene = sc.next;
              break;
            }
          }
        }
        if (!nextScene) nextScene = puzzle.successNext;
        if (nextScene) goToScene(nextScene, true);
      }, 1200);
    } else {
      // Check wrongAnswerMap for specific wrong answers
      if (puzzle.wrongAnswerMap && puzzle.wrongAnswerMap[answer]) {
        AudioEngine.playSFX("wrong");
        els.puzzleInput.classList.add("puzzle-shake", "puzzle-fail");
        setTimeout(function () {
          els.puzzle.classList.remove("visible");
          els.puzzleInput.classList.remove("puzzle-shake", "puzzle-fail");
          els.puzzleInput.disabled = false;
          els.puzzleFeedback.className = "";
          goToScene(puzzle.wrongAnswerMap[answer], true);
        }, 600);
        return;
      }

      AudioEngine.playSFX("wrong");
      if (state.tracker) state.tracker.puzzleFailCount++;
      els.puzzleFeedback.textContent = puzzle.failText;
      els.puzzleFeedback.classList.remove("success");
      els.puzzleInput.classList.add("puzzle-shake", "puzzle-fail");
      setTimeout(function () {
        els.puzzleInput.classList.remove("puzzle-shake", "puzzle-fail");
        els.puzzleInput.value = "";
        els.puzzleInput.focus();
      }, 500);
    }
  }

  /* ---------- Inline Puzzle Hints ---------- */
  function showPuzzleHint() {
    var scene = activeStory.scenes[state.currentScene];
    if (!scene || !scene.hints) return;
    var hints = scene.hints;
    if (puzzleHintIndex >= hints.length) return;

    var div = document.createElement("div");
    div.className = "puzzle-hint-item";
    div.textContent = "💡 " + hints[puzzleHintIndex];
    els.puzzleHintArea.appendChild(div);
    puzzleHintIndex++;

    if (puzzleHintIndex >= hints.length) {
      els.puzzleHintBtn.style.display = "none";
    }
  }

  /* ---------- Evidence Puzzle ---------- */
  // 証拠整理パズルの状態（モジュールレベルで保持）
  var evState = null; // { selected: [], locked: false, ep: {}, cards: {} }

  function showEvidencePuzzle(ep) {
    evState = { selected: [], locked: false, ep: ep, cards: {} };

    els.evidenceInstruction.innerHTML = ep.instruction +
      '<span class="evidence-hint">選んだ証拠はタップで取り消せます</span>';
    els.evidenceFeedback.textContent = "";
    els.evidenceFeedback.className = "";
    els.evidenceSelected.innerHTML = "";
    els.evidenceCandidates.innerHTML = "";

    // スロット描画
    for (var s = 0; s < ep.correctSequence.length; s++) {
      var slotEl = document.createElement("div");
      slotEl.className = "evidence-slot";
      slotEl.textContent = "──";
      els.evidenceSelected.appendChild(slotEl);
    }

    // 候補カード描画（<button> を使う）
    ep.candidates.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "evidence-card";
      btn.textContent = c.label;
      btn.dataset.evidenceId = c.id;
      btn.dataset.evidenceLabel = c.label;
      els.evidenceCandidates.appendChild(btn);
      evState.cards[c.id] = btn;
    });

    els.evidence.classList.add("visible");
  }

  // 候補カード選択
  function evSelectCard(id, label) {
    if (!evState || evState.locked) return;
    if (evState.selected.length >= evState.ep.correctSequence.length) return;
    if (evState.selected.some(function (s) { return s.id === id; })) return;

    evState.selected.push({ id: id, label: label });
    evState.cards[id].classList.add("selected");
    evState.cards[id].disabled = true;
    AudioEngine.playSFX("tap");
    evUpdateSlots();

    if (evState.selected.length === evState.ep.correctSequence.length) {
      evCheckAnswer();
    }
  }

  // スロットタップで取り消し
  function evRemoveSlot(idx) {
    if (!evState || evState.locked) return;
    if (idx >= evState.selected.length) return;

    var removed = evState.selected.splice(idx, 1)[0];
    evState.cards[removed.id].classList.remove("selected");
    evState.cards[removed.id].disabled = false;
    els.evidenceFeedback.textContent = "";
    els.evidenceFeedback.className = "";
    evUpdateSlots();
  }

  // スロット表示を更新
  function evUpdateSlots() {
    var slotEls = els.evidenceSelected.children;
    for (var i = 0; i < slotEls.length; i++) {
      if (i < evState.selected.length) {
        slotEls[i].className = "evidence-slot filled";
        slotEls[i].textContent = evState.selected[i].label;
        slotEls[i].dataset.slotIndex = i;
      } else {
        slotEls[i].className = "evidence-slot";
        slotEls[i].textContent = "──";
        delete slotEls[i].dataset.slotIndex;
      }
    }
  }

  // 判定（順不同：セット比較）
  function evCheckAnswer() {
    var ep = evState.ep;
    var selectedIds = evState.selected.map(function (s) { return s.id; }).sort();
    var correctIds = ep.correctSequence.slice().sort();
    var correct = selectedIds.length === correctIds.length &&
      selectedIds.every(function (id, i) { return id === correctIds[i]; });

    evState.locked = true;

    if (correct) {
      AudioEngine.playSFX("correct");
      els.evidenceFeedback.textContent = ep.successText;
      els.evidenceFeedback.className = "success";
      var evSuccessNext = ep.successNext || "ch3_final_puzzle";
      setTimeout(function () {
        els.evidence.classList.remove("visible");
        evState = null;
        goToScene(evSuccessNext, true);
      }, 1500);
    } else {
      AudioEngine.playSFX("wrong");
      els.evidenceFeedback.textContent = ep.failText;
      els.evidenceFeedback.className = "";
      setTimeout(function () {
        if (!evState) return;
        evState.locked = false;
        evState.selected = [];
        Object.keys(evState.cards).forEach(function (id) {
          evState.cards[id].classList.remove("selected");
          evState.cards[id].disabled = false;
        });
        evUpdateSlots();
        els.evidenceFeedback.textContent = "";
      }, 1200);
    }
  }

  // イベント委譲：evidence-container 上の click を一括処理
  els.evidence.addEventListener("click", function (e) {
    e.stopPropagation(); // gameScreen のハンドラに渡さない
    if (!evState) return;

    // 候補カードがクリックされた？
    var cardBtn = e.target.closest("[data-evidence-id]");
    if (cardBtn) {
      evSelectCard(cardBtn.dataset.evidenceId, cardBtn.dataset.evidenceLabel);
      return;
    }

    // スロットがクリックされた？
    var slotEl = e.target.closest(".evidence-slot.filled");
    if (slotEl && slotEl.dataset.slotIndex !== undefined) {
      evRemoveSlot(parseInt(slotEl.dataset.slotIndex, 10));
      return;
    }
  });

  /* ---------- Clear Record ---------- */
  function loadClearRecord() {
    var raw = localStorage.getItem(casePrefix + "clear");
    if (!raw) return { true_end: false, normal_end: false, bad_end: false, secret_end: false };
    try {
      var r = JSON.parse(raw);
      if (r.bad_end === undefined) r.bad_end = false;
      if (r.secret_end === undefined) r.secret_end = false;
      return r;
    }
    catch (e) { return { true_end: false, normal_end: false, bad_end: false, secret_end: false }; }
  }

  function saveClearRecord(endingType) {
    try {
      var record = loadClearRecord();
      if (endingType === "true") record.true_end = true;
      else if (endingType === "bad") record.bad_end = true;
      else record.normal_end = true;
      localStorage.setItem(casePrefix + "clear", JSON.stringify(record));
    } catch (e) { /* ignore */ }
  }

  /* ---------- Title Screen Update ---------- */
  function updateTitleScreen() {
    // Continue button
    var btnContinue = $("btn-continue");
    try {
      var autoRaw = localStorage.getItem(casePrefix + "auto");
      if (autoRaw) {
        btnContinue.disabled = false;
        try {
          var data = JSON.parse(autoRaw);
          var label = data.chapterLabel || "";
          els.btnContinueInfo.textContent = label;
        } catch (e) {
          els.btnContinueInfo.textContent = "";
        }
      } else {
        btnContinue.disabled = true;
        els.btnContinueInfo.textContent = "";
      }
    } catch (e) {
      btnContinue.disabled = true;
      els.btnContinueInfo.textContent = "";
    }

    // Clear record
    var record = loadClearRecord();
    var html = "";
    if (currentCase === 1) {
      // CASE_01: エンディングは1つのみ
      if (record.true_end) {
        var insightStr = "";
        try {
          var prof = JSON.parse(localStorage.getItem("hageruya_c1_profile") || "{}");
          var iv = typeof prof.insight === "number" ? prof.insight : 5;
          for (var ii = 0; ii < 5; ii++) insightStr += ii < iv ? "◆" : "◇";
        } catch (e) { insightStr = "◆◆◆◆◆"; }
        html += '<div class="clear-record-item achieved">◆ CASE_01 クリア済（洞察 ' + insightStr + '）</div>';
      }
    } else {
      // CASE_02: 4エンディング
      var anyCleared = record.normal_end || record.true_end || record.bad_end || record.secret_end;
      if (anyCleared) {
        if (record.bad_end) {
          html += '<div class="clear-record-item achieved">◆ BAD END 到達済</div>';
        } else {
          html += '<div class="clear-record-item">◇ BAD END ──</div>';
        }
        if (record.normal_end) {
          html += '<div class="clear-record-item achieved">◆ NORMAL END 到達済</div>';
        } else {
          html += '<div class="clear-record-item">◇ NORMAL END ──</div>';
        }
        if (record.true_end) {
          html += '<div class="clear-record-item achieved">◆ TRUE END 到達済 ── 事件解決</div>';
        } else {
          html += '<div class="clear-record-item">◇ TRUE END ── 事件解決</div>';
        }
        if (record.secret_end) {
          html += '<div class="clear-record-item achieved">◆ SECRET END 到達済 ── 真の結末</div>';
        } else {
          html += '<div class="clear-record-item">◇ SECRET END ── 真の結末</div>';
        }
      }
    }
    els.titleClearRecord.innerHTML = html;

    // Update case label (skip for MIRROR)
    var caseLabel = $("title-case-label");
    if (caseLabel && !isMirror()) {
      caseLabel.textContent = currentCase === 2
        ? "CASE_02 : THE EXPERIMENT"
        : "CASE_01 : THE CELLAR";
    }
  }

  function updateCaseSelector() {
    var selector = $("case-selector");
    var btn1 = $("case-btn-1");
    var btn2 = $("case-btn-2");
    if (!selector || !btn1 || !btn2) return;

    var hasProfile = false;
    try { hasProfile = !!localStorage.getItem("hageruya_c1_profile"); } catch (e) {}

    // Hide entire case selector until CASE_01 is cleared
    if (!hasProfile) {
      selector.style.display = "none";
      return;
    }

    selector.style.display = "flex";
    btn2.classList.remove("locked");

    // Active state
    btn1.classList.toggle("active", currentCase === 1);
    btn2.classList.toggle("active", currentCase === 2);
  }

  /* ---------- Confirm Dialog ---------- */
  var confirmCallback = null;

  function showConfirm(message, onYes) {
    els.confirmText.textContent = message;
    els.confirmDialog.classList.add("active");
    confirmCallback = onYes;
  }

  function closeConfirm() {
    els.confirmDialog.classList.remove("active");
    confirmCallback = null;
  }

  /* ---------- Save / Load ---------- */
  var autoSaveTimer = null;
  function autoSave() {
    saveToSlot("auto");
    var el = $("autosave-indicator");
    if (el) {
      el.classList.remove("visible");
      void el.offsetHeight;
      el.classList.add("visible");
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(function () {
        el.classList.remove("visible");
      }, 1500);
    }
  }

  function saveToSlot(slot) {
    try {
      if (slot !== "auto" && state.tracker) state.tracker.saveCount++;
      var data = {
        state: JSON.parse(JSON.stringify(state)),
        timestamp: Date.now(),
        chapterLabel: els.chapterLabel.textContent
      };
      localStorage.setItem(casePrefix + slot, JSON.stringify(data));
    } catch (e) {
      notify("保存に失敗しました");
    }
  }

  function loadFromSlot(slot) {
    try {
      var raw = localStorage.getItem(casePrefix + slot);
      if (!raw) return false;
      var data = JSON.parse(raw);
      // Merge loaded state with defaults for forward compatibility
      var base = createInitialState();
      state = Object.assign(base, data.state);
      // Ensure tracker and playerName exist for old saves
      if (!state.tracker) state.tracker = base.tracker;
      if (!state.playerName) state.playerName = "";
      // CASE_02ロード時にc1Profile復元
      if (currentCase === 2 && !state.c1Profile) {
        try {
          var c1Raw = localStorage.getItem("hageruya_c1_profile");
          if (c1Raw) state.c1Profile = JSON.parse(c1Raw);
        } catch (e2) { /* ignore */ }
      }
      return true;
    } catch (e) {
      notify("データの読み込みに失敗しました");
      return false;
    }
  }

  function renderSaveSlots() {
    var slots = ["auto", "1", "2", "3"];
    var labels = ["オートセーブ", "スロット 1", "スロット 2", "スロット 3"];
    els.saveSlots.innerHTML = "";

    slots.forEach(function (slot, i) {
      var raw = null;
      var data = null;
      try {
        raw = localStorage.getItem(casePrefix + slot);
        data = raw ? JSON.parse(raw) : null;
      } catch (e) { data = null; }

      var div = document.createElement("div");
      div.className = "save-slot";

      var info = document.createElement("div");
      info.className = "save-slot-info";
      var lbl = document.createElement("div");
      lbl.className = "save-slot-label";
      lbl.textContent = labels[i];
      info.appendChild(lbl);

      var detail = document.createElement("div");
      detail.className = "save-slot-detail";
      if (data) {
        var date = new Date(data.timestamp);
        detail.textContent = data.chapterLabel + "　" +
          date.toLocaleDateString("ja-JP") + " " +
          date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      } else {
        detail.textContent = "── 空 ──";
      }
      info.appendChild(detail);
      div.appendChild(info);

      var actions = document.createElement("div");
      actions.className = "save-slot-actions";

      if (slot !== "auto") {
        var saveBtn = document.createElement("button");
        saveBtn.className = "save-slot-btn";
        saveBtn.textContent = "保存";
        saveBtn.addEventListener("click", (function (s) {
          return function (e) {
            e.stopPropagation();
            saveToSlot(s);
            notify("スロット " + s + " に保存しました");
            AudioEngine.playSFX("tap");
            renderSaveSlots();
          };
        })(slot));
        actions.appendChild(saveBtn);
      }

      if (data) {
        var loadBtn = document.createElement("button");
        loadBtn.className = "save-slot-btn load-btn";
        loadBtn.textContent = "読込";
        loadBtn.addEventListener("click", (function (s) {
          return function (e) {
            e.stopPropagation();
            if (loadFromSlot(s)) {
              closeAllModals();
              clearSceneHistory();
              updateSuspicionIndicator();
              updateInsightIndicator();
              goToScene(state.currentScene);
              notify("データを読み込みました");
            }
          };
        })(slot));
        actions.appendChild(loadBtn);
      }

      div.appendChild(actions);
      els.saveSlots.appendChild(div);
    });
  }

  /* ---------- Clues ---------- */
  function renderClues() {
    if (state.clues.length === 0 && state.memoryFragments.length === 0) {
      els.cluesList.innerHTML = '<div class="clues-empty">── 記録された手がかりはまだない ──</div>';
      return;
    }
    els.cluesList.innerHTML = "";
    state.clues.forEach(function (clue, i) {
      var text = getClueText(clue);
      var div = document.createElement("div");
      div.className = "clue-item";
      div.style.animationDelay = (i * 0.05) + "s";
      div.innerHTML = '<span class="clue-bullet">◆</span><span class="clue-text">' +
        escapeHtml(text) + "</span>";
      els.cluesList.appendChild(div);
    });

    // Memory fragments section
    if (state.memoryFragments.length > 0) {
      var header = document.createElement("div");
      header.className = "memory-section-header";
      header.textContent = "記憶の断片";
      els.cluesList.appendChild(header);

      state.memoryFragments.forEach(function (mem, i) {
        var text = getMemoryText(mem);
        var div = document.createElement("div");
        div.className = "memory-item";
        div.style.animationDelay = ((state.clues.length + i) * 0.05) + "s";
        div.innerHTML = '<span class="clue-bullet">◇</span><span class="clue-text">' +
          escapeHtml(text) + "</span>";
        els.cluesList.appendChild(div);
      });
    }
  }

  /* ---------- Hints ---------- */
  function renderHints() {
    var scene = activeStory.scenes[state.currentScene];
    var hints = scene && scene.hints ? scene.hints : [];

    if (hints.length === 0) {
      els.hintContent.innerHTML = '<div class="hint-empty">── 該当する記録なし ──</div>';
      $("btn-next-hint").style.display = "none";
      return;
    }

    var shown = Math.min(state.hintIndex + 1, hints.length);
    var html = '<div class="hint-counter">ヒント ' + shown + ' / ' + hints.length + '</div>';
    for (var i = 0; i < shown; i++) {
      html += '<div class="hint-text" style="animation-delay:' + (i * 0.1) + 's">💡 ' +
        escapeHtml(hints[i]) + "</div>";
    }
    els.hintContent.innerHTML = html;

    var btnNext = $("btn-next-hint");
    if (state.hintIndex < hints.length - 1) {
      var remaining = hints.length - shown;
      btnNext.textContent = "次のヒントを見る（残り " + remaining + "）";
      btnNext.style.display = "block";
    } else {
      btnNext.style.display = "none";
    }
  }

  /* ---------- Memo ---------- */
  function loadMemo() {
    els.memoArea.value = state.memo || "";
  }
  function saveMemo() {
    state.memo = els.memoArea.value;
    if (state.tracker) state.tracker.memoLength = (state.memo || "").length;
    autoSave();
  }

  /* ---------- Backlog ---------- */
  function renderBacklog() {
    var container = $("backlog-list");
    if (!container) return;
    if (backlog.length === 0) {
      container.innerHTML = '<div class="backlog-empty">── 表示する履歴がありません ──</div>';
      return;
    }
    container.innerHTML = "";
    var recentStart = Math.max(0, backlog.length - 5);
    backlog.forEach(function (entry, i) {
      var div = document.createElement("div");
      var recent = i >= recentStart ? " backlog-recent" : "";
      if (entry.speaker) {
        div.className = "backlog-line backlog-dialogue" + recent;
        div.innerHTML = '<span class="backlog-speaker">' + escapeHtml(entry.speaker) + '</span>' +
          '<span class="backlog-text">「' + escapeHtml(entry.text) + '」</span>';
      } else {
        div.className = "backlog-line backlog-narration" + recent;
        div.innerHTML = '<span class="backlog-text">' + escapeHtml(entry.text) + '</span>';
      }
      container.appendChild(div);
    });
    // 最新行までスクロール
    container.scrollTop = container.scrollHeight;
  }

  /* ---------- Modals ---------- */
  function openModal(id) {
    var modal = $("modal-" + id);
    if (!modal) return;
    modal.classList.add("active");
    if (state.tracker) {
      if (id === "hint") state.tracker.hintCount++;
      if (id === "clues") state.tracker.clueCheckCount++;
    }
    if (id === "save") renderSaveSlots();
    if (id === "clues") renderClues();
    if (id === "hint") renderHints();
    if (id === "memo") loadMemo();
    if (id === "backlog") renderBacklog();
  }

  function closeAllModals() {
    document.querySelectorAll(".modal").forEach(function (m) { m.classList.remove("active"); });
    saveMemo();
  }

  /* ---------- Name Dialog ---------- */
  function showNameDialog(callback) {
    var dialog = $("name-dialog");
    var input = $("name-input");
    var submit = $("name-submit");
    if (!dialog || !input || !submit) { callback("探偵"); return; }

    input.value = "";
    dialog.classList.add("active");
    setTimeout(function () { input.focus(); }, 300);

    function onSubmit() {
      var name = input.value.trim() || "探偵";
      dialog.classList.remove("active");
      submit.removeEventListener("click", onSubmit);
      input.removeEventListener("keydown", onKey);
      callback(name);
    }
    function onKey(e) {
      if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
    }
    submit.addEventListener("click", onSubmit);
    input.addEventListener("keydown", onKey);
  }

  /* ---------- Boot Sequence ---------- */
  var bootTimers = [];

  function showBootSequence(callback) {
    var content = document.querySelector(".title-content");
    var boot = $("boot-sequence");
    var linesContainer = $("boot-lines");
    if (!content || !boot || !linesContainer) { callback("探偵"); return; }

    // CASE_02: 名前入力なし。CASE_01のデータから名前を取得
    if (currentCase === 2) {
      var c2Name = "";
      try {
        var prof = JSON.parse(localStorage.getItem("hageruya_c1_profile") || "{}");
        if (prof.playerName) c2Name = prof.playerName;
      } catch (e) { /* ignore */ }
      if (!c2Name) {
        try {
          var c1Save = JSON.parse(localStorage.getItem("hageruya_auto") || "{}");
          if (c1Save && c1Save.state && c1Save.state.playerName) c2Name = c1Save.state.playerName;
        } catch (e) { /* ignore */ }
      }
      c2Name = c2Name || "探偵";

      bootTimers.forEach(clearTimeout);
      bootTimers = [];
      linesContainer.innerHTML = "";
      content.classList.add("boot-active");

      bootTimers.push(setTimeout(function () {
        boot.classList.add("active");
        var c2Lines = [
          { text: "> 接続中…", delay: 400 },
          { text: "> 被験者データ検索中…", delay: 2200 },
          { text: "> 被験者 " + c2Name + " を認証… 完了", delay: 4000 }
        ];
        c2Lines.forEach(function (lineData) {
          bootTimers.push(setTimeout(function () {
            var div = document.createElement("div");
            div.className = "boot-line";
            linesContainer.appendChild(div);
            var ci = 0;
            function typeC2() {
              if (ci < lineData.text.length) {
                div.textContent += lineData.text[ci];
                ci++;
                bootTimers.push(setTimeout(typeC2, 40));
              }
            }
            typeC2();
          }, lineData.delay));
        });
        // 名前入力なしで自動進行
        bootTimers.push(setTimeout(function () {
          trace("boot cleanup firing", "c2Name=" + c2Name);
          bootTimers.forEach(clearTimeout);
          bootTimers = [];
          boot.classList.remove("active");
          linesContainer.innerHTML = "";
          content.classList.remove("boot-active");
          callback(c2Name);
        }, 6500));
      }, 400));
      return;
    }

    // CASE_01: 従来の名前入力あり
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
    linesContainer.innerHTML = "";
    content.classList.add("boot-active");

    bootTimers.push(setTimeout(function () {
      boot.classList.add("active");

      var lines = isMirror() ? [
        { text: "> 接続中…", delay: 400 },
        { text: "> MIRROR 起動", delay: 2200 },
        { text: "> 記録を開始します…", delay: 4000 }
      ] : [
        { text: "> 接続中…", delay: 400 },
        { text: "> ログ取得開始", delay: 2200 },
        { text: "> 被験者を特定しています…", delay: 4000 }
      ];

      lines.forEach(function (lineData) {
        bootTimers.push(setTimeout(function () {
          var div = document.createElement("div");
          div.className = "boot-line";
          linesContainer.appendChild(div);
          var i = 0;
          function typeBoot() {
            if (i < lineData.text.length) {
              div.textContent += lineData.text[i];
              i++;
              bootTimers.push(setTimeout(typeBoot, 40));
            }
          }
          typeBoot();
        }, lineData.delay));
      });

      // Show inline name input after terminal text
      bootTimers.push(setTimeout(function () {
        var inputWrap = document.createElement("div");
        inputWrap.className = "boot-input-wrap";
        var promptLine = document.createElement("div");
        promptLine.className = "boot-line";
        promptLine.textContent = isMirror() ? "> 名前を入力 :" : "> 被験者名を入力 :";
        inputWrap.appendChild(promptLine);

        var nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "boot-name-input";
        nameInput.placeholder = "名前";
        nameInput.autocomplete = "off";
        nameInput.maxLength = 10;
        inputWrap.appendChild(nameInput);

        var nameSubmit = document.createElement("button");
        nameSubmit.type = "button";
        nameSubmit.className = "boot-name-submit";
        nameSubmit.textContent = "送信";
        inputWrap.appendChild(nameSubmit);

        linesContainer.appendChild(inputWrap);
        setTimeout(function () { nameInput.focus(); }, 200);

        function onBootSubmit() {
          var name = nameInput.value.trim() || (isMirror() ? "匿名" : "探偵");
          nameSubmit.removeEventListener("click", onBootSubmit);
          nameInput.removeEventListener("keydown", onBootKey);

          // Confirmation line
          var confirmLine = document.createElement("div");
          confirmLine.className = "boot-line";
          linesContainer.appendChild(confirmLine);
          var confirmText = isMirror()
            ? "> " + name + " を記録… 完了"
            : "> 被験者 " + name + " を認証… 完了";
          var ci = 0;
          function typeConfirm() {
            if (ci < confirmText.length) {
              confirmLine.textContent += confirmText[ci];
              ci++;
              bootTimers.push(setTimeout(typeConfirm, 30));
            } else {
              bootTimers.push(setTimeout(function () {
                bootTimers.forEach(clearTimeout);
                bootTimers = [];
                boot.classList.remove("active");
                linesContainer.innerHTML = "";
                content.classList.remove("boot-active");
                callback(name);
              }, 1200));
            }
          }
          typeConfirm();
        }
        function onBootKey(e) {
          if (e.key === "Enter") { e.preventDefault(); onBootSubmit(); }
        }
        nameSubmit.addEventListener("click", onBootSubmit);
        nameInput.addEventListener("keydown", onBootKey);
      }, 6000));
    }, 400));
  }

  /* ---------- Player Type Diagnosis ---------- */
  var TYPE_DATA = {
    manipulator: {
      label: "THE MANIPULATOR",
      ja: "── 操る者 ──",
      desc: "迷いなく選び、状況を支配する。\nすべてを掌中に収めんとする意志。"
    },
    architect: {
      label: "THE ARCHITECT",
      ja: "── 設計者 ──",
      desc: "隅々まで調べ、記録し、組み立てる。\n真実は構造の中に宿ると信じる者。"
    },
    observer: {
      label: "THE OBSERVER",
      ja: "── 傍観者 ──",
      desc: "静かに見つめ、流れに身を委ねる。\n事件の外側から真実を覗き見る者。"
    },
    savior: {
      label: "THE SAVIOR",
      ja: "── 救済者 ──",
      desc: "バランスを取り、誰かを守ろうとする。\n正義と共感の間で揺れる者。"
    }
  };

  function diagnosePlayerType() {
    var t = state.tracker;
    if (!t) return "savior";

    var avgChoice = t.choiceTimestamps.length > 0
      ? t.choiceTimestamps.reduce(function (a, b) { return a + b; }, 0) / t.choiceTimestamps.length
      : 5000;

    var scores = { manipulator: 0, architect: 0, observer: 0, savior: 0 };

    if (t.saveCount >= 5) scores.manipulator += 2;
    if (avgChoice < 3000) scores.manipulator += 2;
    if (t.puzzleFailCount <= 1) scores.manipulator += 1;

    if (t.optionalScenes >= 3) scores.architect += 2;
    if (t.memoLength >= 30) scores.architect += 2;
    if (t.clueCheckCount >= 5) scores.architect += 1;

    if (t.hintCount >= 3) scores.observer += 2;
    if (avgChoice > 8000) scores.observer += 2;
    if (t.optionalScenes <= 1) scores.observer += 1;

    scores.savior += 1;

    var maxType = "savior";
    var maxScore = scores.savior;
    ["manipulator", "architect", "observer"].forEach(function (type) {
      if (scores[type] > maxScore) { maxScore = scores[type]; maxType = type; }
    });
    return maxType;
  }

  /* ---------- MIRROR: Score Map & Templates ---------- */

  var MIRROR_SCORES = {
    // Q1: 声
    q1_a: { j: "OBS", g: "PRD" },
    q1_b: { j: "THK", g: "SAF" },
    q1_c: { j: "INT", g: "FRM" },
    // Q2: 雨
    q2_a: { d: "APP", g: "REL" },
    q2_b: { d: "BND", g: "SAF" },
    q2_c: { d: "LED", g: "ORD" },
    // Q3: 指摘
    q3_a: { j: "INT", d: "LED", g: "ORD" },
    q3_b: { j: "THK", d: "BND", g: "REL" },
    q3_c: { j: "OBS", d: "APP", g: "FRM" },
    // Q4: 評価
    q4_a: { j: "INT", g: "PRD" },
    q4_b: { j: "THK", g: "REL" },
    q4_c: { j: "OBS", g: "FRM" },
    // Q5: 手放す
    q5_a: { g: "FRM" },
    q5_b: { g: "ORD" },
    q5_c: { g: "SAF" }
  };

  var MIRROR_TEMPLATES = {
    guard: {
      SAF: "反応の奥に、繰り返し現れたもの。\n──安全だ。\n壊れないこと。傷つかないこと。もう一度立てること。\nそのために、選ばなかったものが、残っている。\nそれが何かは、もうわかっているはずだ。",
      PRD: "反応の奥に、繰り返し現れたもの。\n──自尊心だ。\n自分が自分であるための、最後の砦。\n誰にも踏ませない場所がある。それで守れている。\n同時に、残らなかったものがある。\nそれが何かは、もうわかっているはずだ。",
      REL: "反応の奥に、繰り返し現れたもの。\n──誰かとの関係だ。\nつながりが切れることへの、静かな恐れ。\nどこまでが自分か、わからなくなっている。\nそれが何かは、もうわかっているはずだ。",
      FRM: "反応の奥に、繰り返し現れたもの。\n──自由だ。\n何にも縛られないこと。自分の意思で選べること。\nその代わりに、残らなかったものがある。\nそれが何かは、もうわかっているはずだ。",
      ORD: "反応の奥に、繰り返し現れたもの。\n──秩序だ。\n正しさ、筋、約束。世界が崩れないための支え。\nその正しさに、自分を合わせている。\nそれが何かは、もうわかっているはずだ。"
    },
    copy: "その反応が、あなたの輪郭だ。"
  };

  var MIRROR_PRIORITY = {
    judgment: ["OBS", "THK", "INT"],
    distance: ["BND", "LED", "APP"],
    guard:    ["SAF", "REL", "PRD", "ORD", "FRM"]
  };

  function mirrorMaxKey(obj, priority) {
    var max = -1;
    var result = priority[0];
    for (var i = 0; i < priority.length; i++) {
      if (obj[priority[i]] > max) {
        max = obj[priority[i]];
        result = priority[i];
      }
    }
    return result;
  }

  function calcMirrorResult() {
    var scores = {
      judgment: { INT: 0, OBS: 0, THK: 0 },
      distance: { APP: 0, BND: 0, LED: 0 },
      guard:    { SAF: 0, PRD: 0, REL: 0, FRM: 0, ORD: 0 }
    };

    for (var i = 1; i <= 5; i++) {
      var chosen = state.choices["m_q" + i];
      var entry = MIRROR_SCORES[chosen];
      if (!entry) continue;
      if (entry.j) scores.judgment[entry.j]++;
      if (entry.d) scores.distance[entry.d]++;
      if (entry.g) scores.guard[entry.g]++;
    }

    return {
      guard: mirrorMaxKey(scores.guard, MIRROR_PRIORITY.guard),
      scores: scores
    };
  }

  /* ---------- Ending ---------- */
  var sequelTimers = [];

  function dismissSequelHook() {
    sequelTimers.forEach(clearTimeout);
    sequelTimers = [];
    var hook = $("sequel-hook");
    if (!hook) return;
    hook.classList.remove("active");
    // Reset all child phase classes
    var ids = [
      "sequel-glitch", "sequel-system", "sequel-narrative", "sequel-title-block",
      "sequel-line-1", "sequel-line-2", "sequel-stats", "sequel-diagnosis"
    ];
    ids.forEach(function (id) {
      var el = $(id);
      if (el) el.className = el.className.replace(/\b(active|visible|fade-out|typed)\b/g, "").trim();
    });
    $("sequel-line-1").textContent = "";
    $("sequel-line-2").textContent = "";
    var clearIds = ["sequel-stats-1", "sequel-stats-2", "sequel-stats-3", "sequel-stats-4",
      "sequel-diagnosis-type", "sequel-diagnosis-desc", "sequel-narrative"];
    clearIds.forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = "";
    });
  }

  function showCase2Transition() {
    var overlay = $("case2-transition");
    var textEl = $("case2-transition-text");
    if (!overlay || !textEl) return;
    textEl.textContent = "おめでとう。\nいよいよ本番です。";
    overlay.style.display = "flex";
    requestAnimationFrame(function () {
      overlay.classList.add("visible");
    });
  }

  function showEnding(endingType) {
    saveClearRecord(endingType);

    // CASE_01完了時にプロフィールをlocalStorageに保存
    if (currentCase === 1) {
      if (endingType === "true") justClearedCase1 = true;
      try {
        var profile = {
          tracker: JSON.parse(JSON.stringify(state.tracker)),
          playerType: diagnosePlayerType(),
          endingType: endingType,
          insight: state.insight,
          playerName: state.playerName
        };
        localStorage.setItem("hageruya_c1_profile", JSON.stringify(profile));
      } catch (e) { /* ignore */ }
    }

    AudioEngine.stopBGM();
    setTimeout(function () { AudioEngine.playBGM("reveal"); }, 500);

    if (currentCase === 2) {
      // CASE_02 エンディングテキスト
      if (endingType === "true") {
        els.endingText.textContent =
          "あなたはシステムを拒絶し、\n白い部屋を後にした。\n\n" +
          "#041という番号が何を意味するのか、\nまだ完全にはわからない。\n\n" +
          "だが──自分が誰であるかは、\n自分で決める。\n\n" +
          "── TRUE END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "あなたは自分自身を取り戻した";
      } else if (endingType === "bad") {
        els.endingText.textContent =
          "適合完了。\n\n" +
          "白い部屋の椅子に座ったまま、\nあなたは動けなくなった。\n\n" +
          "モニターの光だけが、\n静かに点滅を続けている。\n\n" +
          "── BAD END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "ヒント：あなたは本当に被験体ですか？";
      } else if (endingType === "secret") {
        els.endingText.textContent =
          "「分類不能」──システムは、\nあなたを定義できなかった。\n\n" +
          "被験体でも、探偵でもない。\nあなたはどちらでもあり、\nどちらでもなかった。\n\n" +
          "自分の意思で立ち上がったあなたを、\nシステムは記録できなかった。\n\n" +
          "── SECRET END ──\n" +
          "── 被験者#041の記録は、ここに閉じられた ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "すべての真相に到達した";
      } else {
        els.endingText.textContent =
          "あなたは部屋を出た。\n\n" +
          "だが、白い廊下はどこまでも続き、\n出口は見つからなかった。\n\n" +
          "本当に出られたのか──\nその問いに、答えはない。\n\n" +
          "── NORMAL END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "ヒント：適性値を高く保ち、もう一度挑戦しよう";
      }
      if (endingType === "true" || endingType === "secret") {
        els.endingBanner.textContent = "SUBJECT | CASE_02";
      } else {
        els.endingBanner.textContent = "";
      }
    } else if (endingType === "mirror") {
      // MIRROR エンディング（guard のみ表示）
      var mirrorResult = calcMirrorResult();
      els.endingText.textContent = MIRROR_TEMPLATES.guard[mirrorResult.guard];
      els.endingBanner.textContent = "";
      if (els.endingSubtitle) els.endingSubtitle.textContent = MIRROR_TEMPLATES.copy;
    } else {
      // CASE_01 エンディングテキスト（既存）
      if (endingType === "true") {
        els.endingText.textContent =
          "すべての証拠が揃い、事件は完全に解決した。\n\n" +
          "「紅蓮の星」は赤坂の自室から発見された。\n" +
          "オーナー黒崎は回復し、ホテルの売却を白紙に戻した。\n\n" +
          "あなたの推理は、一片の曇りもなく\n真実を照らし出した。\n\n" +
          "── TRUE END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "事件解決 ── CASE_02 が解放されました";
      } else if (endingType === "bad") {
        els.endingText.textContent =
          "あなたの告発は、沈黙で迎えられた。\n\n" +
          "証拠は何も指し示していない。\n" +
          "真犯人は今もこのホテルのどこかで、\nあなたの失態を嘲笑っている。\n\n" +
          "事件は迷宮入りとなった──。\n\n" +
          "── BAD END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "ヒント：証拠をもう一度見直してみよう";
      } else {
        els.endingText.textContent =
          "事件は解決した。だが──\n\n" +
          "決定的な物証を見つけられなかったことが、\n" +
          "小さな棘のように胸に残っている。\n\n" +
          "書斎のどこかに、まだ見落とした手がかりが\n" +
          "眠っているのかもしれない。\n\n" +
          "── NORMAL END ──";
        if (els.endingSubtitle) els.endingSubtitle.textContent = "ヒント：書斎をもっと丁寧に調べてみよう";
      }
      if (endingType === "true") {
        els.endingBanner.textContent = "SUBJECT | CASE_01";
      } else {
        els.endingBanner.textContent = "";
      }
    }
    showScreen("ending");
    if (!isMirror()) setTimeout(function () { AudioEngine.playSFX("correct"); }, 1000);

    // シーケンス演出（ケースに応じて切替）
    startSequelSequence(endingType);
  }

  function startSequelSequence(endingType) {
    if (endingType === "mirror") return;
    var hook = $("sequel-hook");
    if (!hook) return;

    var name = state.playerName || "探偵";

    function sq(fn, delay) {
      sequelTimers.push(setTimeout(fn, delay));
    }

    // タップで閉じる
    var hookCase = currentCase;
    var hookEndingType = endingType;
    hook.addEventListener("click", function closeHook() {
      hook.removeEventListener("click", closeHook);
      dismissSequelHook();
      if (hookCase === 1 && hookEndingType === "true" && typeof STORY_C2 !== "undefined") {
        showCase2Transition();
      }
    });

    if (currentCase === 2) {
      // ── CASE_02 エンディング後の演出 ──
      if (endingType === "true" || endingType === "secret") {
        // CASE_03 余韻演出
        sq(function () { hook.classList.add("active"); }, 3000);
        sq(function () { $("sequel-glitch").classList.add("active"); }, 4500);
        sq(function () { $("sequel-system").classList.add("visible"); }, 6000);
        sq(function () {
          var line = $("sequel-line-1"); line.classList.add("typed");
          typeText(line, "CASE_02 : CLOSED", 60);
        }, 6800);
        sq(function () {
          var line = $("sequel-line-2"); line.classList.add("typed");
          typeText(line, "SUBJECT #041 : IDENTIFIED", 60);
        }, 8500);
        // SECRET限定：観察者の正体への疑念
        if (endingType === "secret") {
          sq(function () {
            var warn = document.createElement("div");
            warn.className = "sequel-system-line";
            warn.classList.add("typed");
            $("sequel-system").appendChild(warn);
            typeText(warn, "WARNING : OBSERVER IDENTITY UNVERIFIED", 50);
          }, 10000);
          sq(function () { $("sequel-system").classList.add("fade-out"); }, 12500);
        } else {
          sq(function () { $("sequel-system").classList.add("fade-out"); }, 11000);
        }
        var narDelay = endingType === "secret" ? 14500 : 13000;
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, "管理者は本当に不在か？", 60);
        }, narDelay);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, narDelay + 5000);
        sq(function () {
          $("sequel-case").textContent = "CASE_03";
          $("sequel-subtitle").textContent = "THE OPERATOR";
          var coming = $("sequel-coming");
          if (coming) coming.textContent = "SUBJECT SYSTEM は稼働を続けている";
          $("sequel-title-block").classList.add("visible");
        }, narDelay + 6500);
      } else if (endingType === "normal") {
        sq(function () { hook.classList.add("active"); }, 4000);
        sq(function () { $("sequel-glitch").classList.add("active"); }, 5500);
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, "……まだ見つけていないものがある。\nシステムは、待っている。", 60);
        }, 7000);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, 13000);
        sq(function () { dismissSequelHook(); }, 14500);
      } else {
        sq(function () { hook.classList.add("active"); }, 5000);
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, "……被験者の反応を記録した。", 70);
        }, 6500);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, 11000);
        sq(function () { dismissSequelHook(); }, 12500);
      }
    } else {
      // ── CASE_01 エンディング後の演出（既存） ──
      if (endingType === "true") {
        var playerType = diagnosePlayerType();
        var typeInfo = TYPE_DATA[playerType];
        var t = state.tracker || {};
        var elapsed = t.startTime ? Date.now() - t.startTime : 0;
        var playMin = Math.floor(elapsed / 60000);
        var playSec = Math.floor((elapsed % 60000) / 1000);
        var playTimeStr = playMin + "m " + String(playSec).padStart(2, "0") + "s";

        var narrative = "この事件は\nあなたの実験だった。";

        sq(function () { hook.classList.add("active"); }, 3000);
        sq(function () { $("sequel-glitch").classList.add("active"); }, 4500);
        sq(function () { $("sequel-system").classList.add("visible"); }, 6000);
        sq(function () {
          var line = $("sequel-line-1"); line.classList.add("typed");
          typeText(line, "CASE_01 : CLOSED", 60);
        }, 6800);
        sq(function () {
          var line = $("sequel-line-2"); line.classList.add("typed");
          typeText(line, "SUBJECT : " + name, 60);
        }, 8500);
        sq(function () { $("sequel-system").classList.add("fade-out"); }, 11000);
        sq(function () {
          $("sequel-stats").classList.add("visible");
          typeText($("sequel-stats-1"), "PLAY TIME : " + playTimeStr, 40);
        }, 12500);
        sq(function () {
          typeText($("sequel-stats-2"), "SCENES VIEWED : " + (t.sceneCount || 0), 40);
        }, 14000);
        sq(function () {
          typeText($("sequel-stats-3"), "HINTS USED : " + (t.hintCount || 0), 40);
        }, 15500);
        sq(function () {
          typeText($("sequel-stats-4"), "PUZZLE FAILURES : " + (t.puzzleFailCount || 0), 40);
        }, 17000);
        sq(function () { $("sequel-stats").classList.add("fade-out"); }, 19500);
        sq(function () {
          $("sequel-diagnosis-type").textContent = typeInfo.label;
          $("sequel-diagnosis-desc").textContent = typeInfo.ja + "\n" + typeInfo.desc;
          $("sequel-diagnosis").classList.add("visible");
        }, 21000);
        sq(function () { $("sequel-diagnosis").classList.add("fade-out"); }, 26000);
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, narrative, 60);
        }, 27500);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, 33000);
        sq(function () {
          $("sequel-case").textContent = "CASE_02";
          $("sequel-subtitle").textContent = "THE EXPERIMENT";
          $("sequel-title-block").classList.add("visible");
        }, 34500);
        // CASE_02遷移オーバーレイを表示
        sq(function () {
          dismissSequelHook();
          showCase2Transition();
        }, 40000);

      } else if (endingType === "normal") {
        sq(function () { hook.classList.add("active"); }, 4000);
        sq(function () { $("sequel-glitch").classList.add("active"); }, 5500);
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, "……見落としがある。\nまだ、終わっていない。", 60);
        }, 7000);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, 13000);
        sq(function () { dismissSequelHook(); }, 14500);

      } else {
        sq(function () { hook.classList.add("active"); }, 5000);
        sq(function () {
          var narEl = $("sequel-narrative");
          narEl.textContent = "";
          narEl.classList.add("visible");
          typeText(narEl, "……それもまた、想定通りだ。", 70);
        }, 6500);
        sq(function () { $("sequel-narrative").classList.add("fade-out"); }, 11000);
        sq(function () { dismissSequelHook(); }, 12500);
      }
    }
  }

  function typeText(el, text, speed) {
    var i = 0;
    function tick() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        sequelTimers.push(setTimeout(tick, speed));
      }
    }
    tick();
  }

  /* ---------- Utility ---------- */
  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- Event listeners ---------- */
  function init() {
    // ブートスプラッシュ（CSSアニメーション終了後に削除）
    var splash = document.getElementById("boot-splash");
    if (splash) {
      var removeSplash = function () {
        if (splash && splash.parentNode) splash.remove();
      };
      splash.addEventListener("animationend", removeSplash);
      splash.addEventListener("webkitAnimationEnd", removeSplash);
      // フォールバック: animationendが発火しない環境用
      setTimeout(removeSplash, 2000);
    }

    initParticles();
    window.addEventListener("resize", resizeCanvas);

    /* ---------- Debug: URL parameter shortcuts ---------- */
    var debugParams = new URLSearchParams(window.location.search);
    var debugScene = debugParams.get("scene");
    var debugMode = debugParams.get("debug") === "true";

    function startNewGame() {
      // 修正2: デバッグ時は boot 演出をスキップし名前入力のみ
      var bootCallback = function (name) {
        trace("bootCallback fired", "name=" + name, "case=" + currentCase, "transitioning=" + sceneTransitioning);
        sceneTransitioning = false; // 安全リセット: boot後に残留していた場合に備える
        AudioEngine.stopBGM();
        state = createInitialState();
        state.playerName = name;
        state.tracker.startTime = Date.now();
        if (currentCase === 2) {
          try {
            var raw = localStorage.getItem("hageruya_c1_profile");
            if (raw) state.c1Profile = JSON.parse(raw);
          } catch (e) { /* ignore */ }
        }
        // Debug: 記憶の断片・手がかりを付与（通常プレイと同じテキスト）
        if (debugMode) {
          state.memoryFragments = [
            { id: "mem1", text: "山道でラベンダーの香りを感じた瞬間、胸が締めつけられた", chapter: 0 },
            { id: "mem2", text: "『毒物学入門』に触れた時、説明できない不安を感じた", chapter: 1 },
            { id: "mem3", text: "引き出し裏の傷跡に触れた時、理由の分からない不安を感じた", chapter: 2 }
          ];
          state.suspicionLevel = 3;
          state.clues = [
            { id: "bookshelf_toxin", text: "書棚の『毒物学入門』に睡眠薬のページの折り目" },
            { id: "medicine_evidence", text: "薬品棚のトリアゾラム（睡眠薬）管理簿に赤坂の署名" }
          ];
        }
        // Debug: 開始シーン指定
        var startScene = debugScene && activeStory.scenes[debugScene]
          ? debugScene
          : (currentCase === 2 ? "c2_intro" : "prologue");
        goToScene(startScene);
      };
      if (debugMode) {
        showNameDialog(bootCallback);
      } else {
        showBootSequence(bootCallback);
      }
    }

    // Debug: sceneパラメータがあればタイトル画面をスキップして即開始
    if (debugScene) {
      // 修正1: c2_ で始まるシーンは CASE_02 に切り替えてから検証
      if (debugScene.startsWith("c2_") || debugScene.startsWith("case2_")) {
        switchToCase(2);
      }
      ensureAudio();
      startNewGame();
    }

    $("btn-new-game").addEventListener("click", function () {
      ensureAudio();
      var hasSave = false;
      try { hasSave = !!localStorage.getItem(casePrefix + "auto"); } catch (e) {}
      if (hasSave) {
        showConfirm(
          "セーブデータがあります。\nはじめからプレイしますか？\n（セーブデータは残ります）",
          startNewGame
        );
      } else {
        startNewGame();
      }
    });

    $("btn-continue").addEventListener("click", function () {
      ensureAudio();
      AudioEngine.stopBGM();
      sceneTransitioning = false; // 安全リセット
      if (loadFromSlot("auto")) {
        trace("btn-continue", "loadedScene=" + state.currentScene);
        clearSceneHistory();
        updateSuspicionIndicator();
        updateInsightIndicator();
        goToScene(state.currentScene);
        notify("オートセーブから再開しました");
      } else {
        notify("セーブデータがありません");
      }
    });

    // Confirm dialog events
    els.confirmYes.addEventListener("click", function (e) {
      e.stopPropagation();
      var cb = confirmCallback;
      closeConfirm();
      if (cb) cb();
    });
    els.confirmNo.addEventListener("click", function (e) {
      e.stopPropagation();
      closeConfirm();
    });
    els.confirmDialog.querySelector(".confirm-overlay").addEventListener("click", function (e) {
      e.stopPropagation();
      closeConfirm();
    });

    updateTitleScreen();
    updateCaseSelector();

    // Case selector buttons
    document.querySelectorAll(".case-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (btn.classList.contains("locked")) return;
        var caseNum = parseInt(btn.dataset.case, 10);
        if (caseNum === currentCase) return;
        switchToCase(caseNum);
        updateCaseSelector();
        updateTitleScreen();
      });
    });

    $("btn-reset-record").addEventListener("click", function (e) {
      e.stopPropagation();
      showConfirm("到達記録とセーブデータをすべて削除しますか？", function () {
        try {
          localStorage.removeItem(casePrefix + "clear");
          localStorage.removeItem(casePrefix + "auto");
          localStorage.removeItem(casePrefix + "1");
          localStorage.removeItem(casePrefix + "2");
          localStorage.removeItem(casePrefix + "3");
        } catch (err) { /* ignore */ }
        updateTitleScreen();
        notify("データをリセットしました");
      });
    });

    els.soundToggle.addEventListener("click", handleSoundToggle);
    if (els.titleSoundToggle) {
      els.titleSoundToggle.addEventListener("click", handleSoundToggle);
    }

    // テキスト送りタップ処理（touch + click 両対応）
    // game-screen 全体で受けることで、text-container 外のタップでも進行可能にする
    var gameScreen = screens.game;
    var tapStartY = null;
    var tapStartTime = 0;

    function handleTextTap() {
      ensureAudio();
      trace("handleTextTap", "scene=" + state.currentScene, "textIndex=" + textIndex, "queueLen=" + textQueue.length, "transitioning=" + sceneTransitioning, "isTyping=" + isTyping);
      if (sceneTransitioning) { trace("BLOCKED: sceneTransitioning"); return; }
      if (els.choices.classList.contains("visible")) { trace("BLOCKED: choices visible"); return; }
      if (els.puzzle.classList.contains("visible")) { trace("BLOCKED: puzzle visible"); return; }
      if (els.evidence.classList.contains("visible")) { trace("BLOCKED: evidence visible"); return; }

      var scene = activeStory.scenes[state.currentScene];
      if (!scene) { trace("BLOCKED: scene not found for", state.currentScene, "activeStory=", activeStory === STORY_C2 ? "C2" : "C1"); return; }

      if (textIndex < textQueue.length) {
        advanceText();
      } else if (resolveNext(scene) && !hasVisibleChoices(scene) && !scene.quiz && !scene.puzzle && !scene.evidencePuzzle) {
        AudioEngine.playSFX("tap");
        goToScene(resolveNext(scene), true);
      }
    }

    function isInteractiveTarget(el) {
      return !!(el && el.closest && el.closest("#toolbar, #sound-toggle, .choice-btn, #puzzle-container, #evidence-container"));
    }

    // evidence-container のタッチは gameScreen に伝播させない
    els.evidence.addEventListener("touchstart", function (e) {
      e.stopPropagation();
    }, { passive: true });
    els.evidence.addEventListener("touchend", function (e) {
      e.stopPropagation();
    }, { passive: true });

    // テキストエリアの手動スクロール検出（上スクロールで自動追従を一時停止）
    var textContainer = $("text-container");
    textContainer.addEventListener("scroll", function () {
      var atBottom = textContainer.scrollHeight - textContainer.scrollTop - textContainer.clientHeight < 20;
      if (!atBottom && isTyping) {
        userScrolled = true;
      } else if (atBottom) {
        userScrolled = false;
      }
    }, { passive: true });

    gameScreen.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        tapStartY = e.touches[0].clientY;
        tapStartTime = Date.now();
      }
    }, { passive: true });

    var lastTouchTime = 0;
    gameScreen.addEventListener("touchend", function (e) {
      if (tapStartY === null) return;
      if (isInteractiveTarget(e.target)) { tapStartY = null; return; }
      var dy = Math.abs(e.changedTouches[0].clientY - tapStartY);
      var dt = Date.now() - tapStartTime;
      tapStartY = null;
      // スクロール操作と区別：移動量が小さく、短時間のタッチのみタップ扱い
      if (dy < 30 && dt < 600) {
        e.preventDefault(); // 後続の click イベントを抑止して二重発火を防ぐ
        lastTouchTime = Date.now();
        handleTextTap();
      }
    }, { passive: false });

    // マウス操作（PC）のフォールバック — 直近の touchend から短時間なら無視
    gameScreen.addEventListener("click", function (e) {
      if (Date.now() - lastTouchTime < 400) return;
      if (isInteractiveTarget(e.target)) return;
      handleTextTap();
    });

    $("puzzle-submit").addEventListener("click", function (e) {
      e.stopPropagation();
      submitPuzzle();
    });
    els.puzzleInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submitPuzzle(); }
    });

    els.puzzleHintBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      showPuzzleHint();
    });

    // 戻るボタン
    $("btn-back").addEventListener("click", function (e) {
      e.stopPropagation();
      if (sceneHistory.length === 0) return;
      AudioEngine.playSFX("tap");
      goBack();
    });

    document.querySelectorAll(".toolbar-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!btn.dataset.action) return;
        AudioEngine.playSFX("tap");
        openModal(btn.dataset.action);
      });
    });

    document.querySelectorAll(".modal-close").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeAllModals();
      });
    });
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        e.stopPropagation();
        closeAllModals();
      });
    });

    $("btn-next-hint").addEventListener("click", function (e) {
      e.stopPropagation();
      state.hintIndex++;
      renderHints();
    });

    $("btn-restart").addEventListener("click", function () {
      dismissSequelHook();
      AudioEngine.stopBGM();
      clearSceneHistory();
      showScreen("title");
      showBootSequence(function (name) {
        trace("btn-restart bootCallback", "name=" + name, "transitioning=" + sceneTransitioning);
        sceneTransitioning = false; // 安全リセット
        state = createInitialState();
        state.playerName = name;
        state.tracker.startTime = Date.now();
        if (currentCase === 2) {
          try {
            var raw = localStorage.getItem("hageruya_c1_profile");
            if (raw) state.c1Profile = JSON.parse(raw);
          } catch (e) { /* ignore */ }
        }
        goToScene(currentCase === 2 ? "c2_intro" : "prologue");
      });
    });

    $("btn-to-title").addEventListener("click", function () {
      dismissSequelHook();
      AudioEngine.stopBGM();
      clearSceneHistory();
      state = createInitialState();
      // Ensure boot sequence is cleaned up
      var bootEl = $("boot-sequence");
      var bootLines = $("boot-lines");
      if (bootEl) bootEl.classList.remove("active");
      if (bootLines) bootLines.innerHTML = "";
      var titleContent = document.querySelector(".title-content");
      if (titleContent) titleContent.classList.remove("boot-active");
      // CASE_01初クリア直後はCASE_02を選択状態にする
      if (justClearedCase1 && typeof STORY_C2 !== "undefined") {
        justClearedCase1 = false;
        switchToCase(2);
      }
      updateTitleScreen();
      updateCaseSelector();
      showScreen("title");
      setTimeout(function () { AudioEngine.playBGM("title"); }, 600);
    });

    // CASE_02遷移オーバーレイ
    (function () {
      var overlay = $("case2-transition");
      var textEl = $("case2-transition-text");
      var backBtn = $("case2-transition-back");
      if (!overlay) return;

      function startCase2() {
        overlay.classList.remove("visible");
        overlay.style.display = "";  // showCase2Transition のインラインstyle を解除
        AudioEngine.stopBGM();
        clearSceneHistory();
        switchToCase(2);
        showScreen("title");
        showBootSequence(function (name) {
          trace("startCase2 bootCallback", "name=" + name, "transitioning=" + sceneTransitioning);
          sceneTransitioning = false; // 安全リセット
          state = createInitialState();
          state.playerName = name;
          state.tracker.startTime = Date.now();
          try {
            var raw = localStorage.getItem("hageruya_c1_profile");
            if (raw) state.c1Profile = JSON.parse(raw);
          } catch (e) { /* ignore */ }
          goToScene("c2_intro");
        });
      }

      overlay.addEventListener("click", function (e) {
        if (e.target === backBtn) return;
        startCase2();
      });

      backBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        overlay.classList.remove("visible");
        overlay.style.display = "";  // showCase2Transition のインラインstyle を解除
        dismissSequelHook();
        AudioEngine.stopBGM();
        clearSceneHistory();
        state = createInitialState();
        var bootEl = $("boot-sequence");
        var bootLines = $("boot-lines");
        if (bootEl) bootEl.classList.remove("active");
        if (bootLines) bootLines.innerHTML = "";
        var titleContent = document.querySelector(".title-content");
        if (titleContent) titleContent.classList.remove("boot-active");
        if (justClearedCase1 && typeof STORY_C2 !== "undefined") {
          justClearedCase1 = false;
          switchToCase(2);
        }
        updateTitleScreen();
        updateCaseSelector();
        showScreen("title");
        if (!isMirror()) setTimeout(function () { AudioEngine.playBGM("title"); }, 600);
      });
    })();

    // 初期化：ミュートアイコン同期
    syncSoundIcons();

    // デバッグモード: ?debug=c2 または ?debug=c2test4 等
    var debugParam = new URLSearchParams(window.location.search).get("debug");
    if (debugParam && debugParam.startsWith("c2") && typeof STORY_C2 !== "undefined") {
      switchToCase(2);
      state = createInitialState();
      var debugName = "Unknown";
      try {
        var raw = localStorage.getItem("hageruya_c1_profile");
        if (raw) {
          var prof = JSON.parse(raw);
          if (prof.playerName) debugName = prof.playerName;
          state.c1Profile = prof;
        }
      } catch (e) { /* ignore */ }
      state.playerName = debugName;
      state.tracker.startTime = Date.now();
      var debugScene = "c2_intro";
      if (debugParam.length > 2) {
        var target = "c2_" + debugParam.slice(2);
        if (STORY_C2.scenes[target]) debugScene = target;
      }
      showScreen("game");
      updateInsightIndicator();
      goToScene(debugScene);
      return;
    }

    showScreen("title");

    // タイトル画面タッチでAudio初期化 + タイトルBGM開始
    var titleTouchHandler = function () {
      ensureAudio();
      syncSoundIcons();
      if (!isMirror()) AudioEngine.playBGM("title");
      screens.title.removeEventListener("click", titleTouchHandler);
    };
    screens.title.addEventListener("click", titleTouchHandler);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
