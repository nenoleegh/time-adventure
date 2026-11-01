import {
  petHealthRisk,
  petNeglectHours,
  petSizeScale,
  petStatusLabel,
  petVisualState,
  PET_CARE_COSTS,
  PET_WEIGHT,
  PET_MILESTONES,
  petCareAvailability,
} from "../services/pet-rules.js?v=1.11.0";
import { escapeHtml, icon } from "../ui/html.js?v=1.11.0";

function needBar(label, value, kind) {
  return `
    <div class="pet-need ${kind}">
      <div><span>${label}</span><strong>${Math.round(value)}%</strong></div>
      <div class="pet-need-track"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>
    </div>`;
}

function eggScreen(profile) {
  const taps = profile.eggTaps || 0;
  return `
    <div class="pet-page">
      <div class="page-heading pet-heading">
        <div>
          <span class="eyebrow">小恐龙实验室</span>
          <h1>先听听蛋里的声音</h1>
          <p>轻轻敲一敲蛋壳。敲开三次后，再给即将出生的小恐龙起一个名字。</p>
        </div>
        <span class="rule-version">测试功能</span>
      </div>
      <section class="pet-egg-card">
        <div class="egg-sky">
          <span class="pixel-star star-one"></span>
          <span class="pixel-star star-two"></span>
          <span class="pixel-star star-three"></span>
          <div class="pixel-egg egg-cracks-${taps}">
            <span class="egg-spot a"></span>
            <span class="egg-spot b"></span>
            <span class="egg-spot c"></span>
            <span class="egg-crack"></span>
          </div>
          <div class="egg-shadow"></div>
        </div>
        <div class="egg-progress">
          <span>蛋壳已经敲了 <strong>${taps} / 3</strong> 次</span>
          <div><i style="width:${(taps / 3) * 100}%"></i></div>
        </div>
        <button class="button primary pet-egg-button" data-action="pet-tap-egg">
          ${icon("heart")}${taps ? "再敲一下" : "敲敲蛋壳"}
        </button>
        <p>不着急，每次轻点都会让蛋壳出现新的裂纹。</p>
      </section>
    </div>`;
}

function endedScreen(profile) {
  const days = Math.max(
    1,
    Math.ceil(
      (new Date(profile.endedAt || Date.now()).getTime() -
        new Date(profile.hatchedAt || profile.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  return `
    <div class="pet-page">
      <div class="page-heading pet-heading">
        <div>
          <span class="eyebrow">小恐龙实验室</span>
          <h1>${escapeHtml(profile.name)}暂时回到了蛋里</h1>
          <p>它陪你走过 ${days} 天。照料记录和孵化回忆会保留下来。</p>
        </div>
      </div>
      <section class="pet-ended-card">
        <div class="fossil-egg">✦</div>
        <span class="eyebrow">这段旅程已经结束</span>
        <h2>休息好了，可以开始新的相遇</h2>
        <p>重新领养后会得到一颗新蛋，需要再次敲开蛋壳并起名字。之前的陪伴记录仍然保留。</p>
        <button class="button primary" data-action="pet-readopt">${icon("heart")}重新领养</button>
      </section>
    </div>`;
}

function petSpeech(status) {
  return {
    healthy: "今天也一起完成计划吧！我在这里等你回来。",
    low: "我有一点没精神……你能陪陪我吗？",
    sick: "我好像生病了，需要治疗和照顾。",
    critical: "我很不舒服，请快一点帮帮我。",
    recovering: "我正在慢慢恢复，再陪我一小会儿吧。",
  }[status] || "今天也一起完成计划吧！";
}

function idleSpeech(action) {
  return {
    walk: "我在小屋里走一走，看看今天有什么新发现。",
    selfClean: "身上有点灰，我自己整理一下。",
    headPet: "摸摸脑袋，今天也要加油。",
    sleep: "嘘，我打个盹，休息也是在长身体。",
    cute: "陪我玩一小会儿嘛，我刚刚很乖。",
    play: "小球滚过来了，我要追上去！",
  }[action] || "";
}

function careButton(
  action,
  label,
  sublabel,
  symbol,
  disabled = false,
  cost = 0,
) {
  return `
    <button class="pet-care-button ${action}" data-action="pet-care" data-pet-action="${action}" ${disabled ? "disabled" : ""}>
      <span>${symbol}</span>
      <strong>${label}</strong>
      <small>${sublabel}</small>
      <em>${cost ? `${cost} 互动点` : "免费"}</em>
    </button>`;
}

function healthyScreen(state, profile) {
  const status = profile.status;
  const visualState = petVisualState(profile);
  const healthRisk = petHealthRisk(profile);
  const displayStatus = {
    thirsty: "口渴了",
    hungry: "肚子饿了",
    dirty: "需要清理",
    sick: petStatusLabel(status),
    recovering: "正在恢复",
    healthy: petStatusLabel(status),
  }[visualState];
  const sizeScale = petSizeScale(profile);
  const careDays = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(profile.hatchedAt || profile.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );
  const ageHours = petNeglectHours(profile);
  const idleAction = visualState === "healthy" ? state.petIdleAction || "" : "";
  const canTreat = ["sick", "critical"].includes(status);
  const petPoints = Math.max(0, Number(profile.petPoints) || 0);
  const feedAvailability = petCareAvailability(profile, "feed");
  const waterAvailability = petCareAvailability(profile, "water");
  const cleanAvailability = petCareAvailability(profile, "clean");
  const petAvailability = petCareAvailability(profile, "pet");
  const action = [
    state.petAction ? `action-${state.petAction}` : "",
    idleAction ? `idle-${idleAction}` : "",
  ].filter(Boolean).join(" ");
  const poop = Array.from({ length: Math.min(3, profile.poopCount || 0) })
    .map(() => `<span class="pet-poop">▰</span>`)
    .join("");
  const actionSprite = {
    feed: "hungry",
    water: "thirsty",
    clean: "selfClean",
    pet: "headPet",
    treat: "sick",
  }[state.petAction];
  const idleSprite = {
    walk: "walk",
    selfClean: "selfClean",
    headPet: "headPet",
    sleep: "sleep",
    cute: "cute",
    play: "play",
  }[idleAction];
  const statusSprite =
    visualState === "recovering" ? "sick" : visualState;
  const spriteState = actionSprite ||
    idleSprite ||
    (["thirsty", "hungry", "dirty", "sick"].includes(statusSprite)
      ? statusSprite
      : visualState === "healthy"
        ? "idle"
        : "");
  const spriteMarkup =
    state.petAction === "hatch"
      ? `
        <div class="hatch-in-progress">
          <img class="pet-sprite hatch-baby" src="./assets/dino/dino-baby.png?v=1.11.0" alt="${escapeHtml(profile.name)}刚刚孵化">
          <span class="hatch-shell shell-left"></span>
          <span class="hatch-shell shell-right"></span>
          <span class="hatch-spark spark-one">✦</span>
          <span class="hatch-spark spark-two">✦</span>
        </div>`
      : spriteState
        ? `<div class="pet-state-sprite state-${spriteState}" style="--state-sprite:url('/assets/dino/animations/${spriteState}.png?v=1.11.0')"></div>`
        : `<img class="pet-sprite" src="./assets/dino/dino-baby.png?v=1.11.0" alt="${escapeHtml(profile.name)}，一只像素小恐龙">`;
  const speech =
    state.petAction === "hatch"
      ? `啪嗒！我是${profile.name}，今天出生啦！`
      : idleSpeech(idleAction) || petSpeech(status);
  const speechBottom = Math.min(330, Math.round(28 + 390 * sizeScale));
  return `
    <div class="pet-page">
      <div class="page-heading pet-heading">
        <div>
          <span class="eyebrow">我的小恐龙</span>
          <h1>${escapeHtml(profile.name)} · ${escapeHtml(displayStatus)}</h1>
          <p>陪伴第 ${careDays} 天 · 记得完成喂食、喂水和清理，让小屋保持清爽。</p>
        </div>
        <span class="pet-status ${visualState}">${escapeHtml(displayStatus)}</span>
      </div>

      <div class="pet-layout">
        <div class="pet-main-column">
          <section class="pet-habitat-card">
            <div class="pet-scene ${action} status-${status}" style="--speech-bottom:${speechBottom}px">
              <div class="pet-window-glow"></div>
              <span class="pet-cloud one"></span>
              <span class="pet-cloud two"></span>
              <div class="pet-speech">${escapeHtml(speech)}</div>
              <div class="pet-sprite-wrap" style="--pet-scale:${sizeScale.toFixed(2)}">
                ${spriteMarkup}
              </div>
              ${profile.poopCount && visualState !== "dirty" ? `<div class="pet-poop-area">${poop}</div>` : ""}
            </div>
            <div class="pet-needs-grid">
              ${needBar("饱腹", profile.needs.satiety, "satiety")}
              ${needBar("水分", profile.needs.hydration, "hydration")}
              ${needBar("清洁", profile.needs.cleanliness, "cleanliness")}
              ${needBar("心情", profile.needs.mood, "mood")}
            </div>
            ${healthRisk.atRisk && !["sick", "critical", "recovering"].includes(status) ? `
              <div class="pet-health-warning">
                ${icon("shield")}
                <span>${healthRisk.lowNeeds === 2 ? "饱腹和水分都低于 30%" : "饱腹或水分低于 30%"}，持续偏低容易生病。</span>
              </div>` : ""}
            <div class="pet-care-grid">
              ${careButton("feed", "喂食", feedAvailability.reason === "full" ? "饱腹已满" : "莓果饼干", icon("food"), !feedAvailability.available, PET_CARE_COSTS.feed)}
              ${careButton("water", "喂水", waterAvailability.reason === "full" ? "水分已满" : "清凉泉水", icon("water"), !waterAvailability.available, PET_CARE_COSTS.water)}
              ${careButton("clean", "清理", cleanAvailability.reason === "full" ? "清洁已满" : profile.poopCount ? "需要打扫" : "保持清爽", icon("broom"), !cleanAvailability.available, PET_CARE_COSTS.clean)}
              ${careButton("pet", "抚摸", petAvailability.reason === "full" ? "心情已满" : "陪它玩耍", icon("heart"), !petAvailability.available, PET_CARE_COSTS.pet)}
              ${canTreat ? careButton("treat", "治疗", "使用药品", icon("medicine"), petPoints < PET_CARE_COSTS.treat, PET_CARE_COSTS.treat) : ""}
            </div>
            ${state.petMessage ? `<div class="pet-action-message">${escapeHtml(state.petMessage)}</div>` : ""}
          </section>
        </div>

        <aside class="pet-side-column">
          <section class="pet-streak-card">
            <span class="eyebrow">已经陪伴</span>
            <strong>${careDays}<small>天</small></strong>
            <p>${ageHours < PET_MILESTONES.lowHours ? "今天的照料正在保护它。" : "快回来看看它，需要你的照顾。"}</p>
            <div class="pet-streak-dots">
              ${Array.from({ length: 7 }, (_, index) => `<i class="${index < Math.min(7, careDays) ? "done" : ""}"></i>`).join("")}
            </div>
          </section>

          <section class="pet-points-card">
            <div>
              <span class="eyebrow">互动点</span>
              <strong>${petPoints}</strong>
            </div>
            <p>每完成一项计划任务获得 1 点。喂食、喂水和清理各消耗 1 点，抚摸免费，治疗消耗 2 点。</p>
          </section>

          <section class="pet-weight-card">
            <div><span class="eyebrow">成长体重</span><strong>${Number(profile.weightKg || PET_WEIGHT.birthKg).toFixed(1)}<small>kg</small></strong></div>
            <span>${visualState === "hungry" ? "肚子饿了，喂食后还会慢慢长大。" : "体重会随陪伴和进食增长，最高 12.0kg。"}</span>
            <div class="weight-track"><i style="width:${Math.max(0, Math.min(100, ((Number(profile.weightKg) - PET_WEIGHT.birthKg) / (PET_WEIGHT.maxKg - PET_WEIGHT.birthKg)) * 100))}%"></i></div>
            <small>角色会随体重变大</small>
          </section>

          <section class="pet-journey-card">
            <span class="eyebrow">成长旅程</span>
            <h2>从蛋到伙伴</h2>
            <div class="pet-journey-row done"><b>1</b><span><strong>破壳而出</strong><small>敲开蛋壳并起名字</small></span></div>
            <div class="pet-journey-row done"><b>2</b><span><strong>幼龙期</strong><small>学习喂食、喝水和清理</small></span></div>
            <div class="pet-journey-row"><b>3</b><span><strong>少年期</strong><small>连续照料 7 天解锁</small></span></div>
          </section>

          <section class="pet-log-card">
            <span class="eyebrow">最近照顾</span>
            <div class="pet-log-list">
              ${(state.petCareLog || []).slice(0, 5).map((item) => `
                <div><i></i><span>${escapeHtml(item.message)}</span><small>${new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</small></div>
              `).join("") || `<p>照料记录会出现在这里。</p>`}
            </div>
          </section>
        </aside>
      </div>
    </div>`;
}

export function petView(state) {
  const profile = state.petProfile;
  if (!profile || profile.stage === "egg") return eggScreen(profile || {});
  if (profile.status === "ended") return endedScreen(profile);
  return healthyScreen(state, profile);
}
