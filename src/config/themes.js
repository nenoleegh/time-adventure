export const THEME_OPTIONS = [
  {
    id: "breeze",
    name: "海风汽水",
    tag: "清爽",
    description: "薄荷青与珊瑚橙，清爽但不幼稚。",
    colors: ["#dff7f2", "#147f82", "#ff8b63"],
    themeColor: "#eef8f7",
  },
  {
    id: "sunny",
    name: "柠檬晴空",
    tag: "明亮",
    description: "阳光黄与天空蓝，明亮有精神。",
    colors: ["#fff0b8", "#2b74c8", "#f18a32"],
    themeColor: "#fff7dc",
  },
  {
    id: "berry",
    name: "莓果云朵",
    tag: "想象",
    description: "柔雾紫与莓果红，安静又有想象感。",
    colors: ["#f4e8ff", "#7651a9", "#f27f8b"],
    themeColor: "#fbf3fc",
  },
  {
    id: "forest",
    name: "森林探险",
    tag: "自然",
    description: "嫩叶绿与暖橙色，自然、有行动感。",
    colors: ["#e1f3dc", "#367d4e", "#e18a35"],
    themeColor: "#eff8ed",
  },
  {
    id: "starlight",
    name: "星际巡航",
    tag: "科技",
    description: "深海蓝、电光青与火箭橙，像驾驶自己的飞船。",
    colors: ["#dcecff", "#185ca8", "#ff7950"],
    themeColor: "#eef5ff",
  },
  {
    id: "pixel",
    name: "霓虹像素",
    tag: "电玩",
    description: "未来紫与湖蓝点缀亮粉色，活泼又有游戏感。",
    colors: ["#eadfff", "#6148c7", "#ff6e9d"],
    themeColor: "#f7f1ff",
  },
];

export const DEFAULT_THEME_ID = THEME_OPTIONS[0].id;

export function normalizeThemeId(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value)
    ? value
    : DEFAULT_THEME_ID;
}
