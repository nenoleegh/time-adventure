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
    name: "林间手账",
    tag: "手帐",
    description: "暖米色、苔绿与陶土色，主要卡片使用虚线手账边框。",
    colors: ["#efe6cf", "#4b6b2f", "#c96b35"],
    themeColor: "#f6f1e4",
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
    name: "方块世界",
    tag: "方块",
    description: "草地绿、泥土棕与像素方格，像在积木世界里安排一天。",
    colors: ["#eaf5dc", "#4f7f2f", "#9a5d32"],
    themeColor: "#eef8e5",
  },
];

export const DEFAULT_THEME_ID = THEME_OPTIONS[0].id;

export function normalizeThemeId(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value)
    ? value
    : DEFAULT_THEME_ID;
}
