/* Province boundaries are fetched at runtime so the page stays a simple GitHub Pages site. */
const GEOJSON_URL = "data/china-provinces.json";
const copy = {
  "北京市":"古都中轴线串起宫阙与胡同，今天的北京也是创新与文化交汇的城市。",
  "天津市":"海河穿城而过，近代建筑与相声茶馆共同构成天津的爽朗气质。",
  "河北省":"长城、坝上与渤海相望，是连接京津与广阔华北的重要门户。",
  "山西省":"表里山河，煤炭资源与晋商大院、千年古建共同写下厚重篇章。",
  "内蒙古自治区":"草原、森林与大漠铺展成辽阔画卷，马头琴声悠长。",
  "辽宁省":"山海关外，工业脊梁与滨海风光并肩；沈阳故宫见证历史。",
  "吉林省":"长白山天池、松花江雾凇与黑土地，共同塑造北国的清朗。",
  "黑龙江省":"冰雪大世界与北大荒相映，是中国最北端的壮阔冬日。",
  "上海市":"黄浦江两岸汇集开放、金融与海派文化，城市节奏鲜明。",
  "江苏省":"江南园林、运河古镇与长江海岸线交织，文脉与经济同样繁盛。",
  "浙江省":"西湖、良渚与数字经济在这里相遇，山水间生长出创新活力。",
  "安徽省":"黄山云海、徽州古村与新兴产业，呈现皖地的古今相映。",
  "福建省":"从武夷山到海上丝路起点，闽南风情与海洋文化浓郁鲜活。",
  "江西省":"庐山、鄱阳湖与景德镇瓷火，勾勒出赣鄱大地的秀美。",
  "山东省":"泰山巍峨、黄河入海，儒家文化和海洋文明在此交汇。",
  "河南省":"黄河孕育中原文明，洛阳、开封等古都沉淀着华夏记忆。",
  "湖北省":"大江大湖孕育荆楚文化，武汉三镇隔江相望。",
  "湖南省":"湘江奔流，岳麓书院与张家界奇峰映照湖湘精神。",
  "广东省":"岭南文化、改革开放前沿与漫长海岸线，构成多元活力。",
  "广西壮族自治区":"桂林山水、民族歌圩与北部湾海风，山水人文相得益彰。",
  "海南省":"热带雨林、椰风海韵和自贸港建设，让海岛充满蓬勃生机。",
  "重庆市":"山城依江而建，轻轨穿楼、火锅飘香，立体城市独具风貌。",
  "四川省":"熊猫故乡、天府之国，雪山、盆地与麻辣烟火相映成趣。",
  "贵州省":"喀斯特山地孕育瀑布与村寨，也见证大数据产业的崛起。",
  "云南省":"雪山、雨林与多民族村落并存，是彩云之南的多彩日常。",
  "西藏自治区":"雪域高原、布达拉宫与壮美群山，守护独特而深厚的高原文化。",
  "陕西省":"秦岭南北分野，兵马俑与古都长安诉说文明源远流长。",
  "甘肃省":"河西走廊串起丝路古迹，敦煌壁画闪耀千年光彩。",
  "青海省":"三江之源与青海湖，铺展出高原生态的辽阔与纯净。",
  "宁夏回族自治区":"黄河穿境而过，贺兰山与葡萄园讲述塞上江南。",
  "新疆维吾尔自治区":"天山南北、绿洲与大漠相依，多民族文化在这里交融绽放。",
  "台湾省":"海峡两岸同根同源，阿里山与日月潭是宝岛的秀丽印象。",
  "香港特别行政区":"维港两岸高楼林立，中西交汇的城市气质独具魅力。",
  "澳门特别行政区":"中西建筑、世界遗产街区与多元美食，浓缩在这座海滨城市。"
};
const palette = ["#dc826f", "#e4b162", "#83ae9d", "#8ba7ce", "#c98bb0", "#d3a992"];
const mapRoot = d3.select("#map");
const card = document.querySelector("#province-card");
let svg, path, group, zoomBehavior;

// DataV 的省界环方向与 d3-geo 的球面填充规则相反；翻转后可避免省份变成整块背景。
function normalizeWinding(collection) {
  const flip = geometry => {
    if (!geometry) return;
    if (geometry.type === "Polygon") geometry.coordinates = geometry.coordinates.map(ring => ring.slice().reverse());
    if (geometry.type === "MultiPolygon") geometry.coordinates = geometry.coordinates.map(poly => poly.map(ring => ring.slice().reverse()));
  };
  collection.features.forEach(feature => flip(feature.geometry));
  return collection;
}

function boundsOf(collection) {
  const xs = [], ys = [];
  const visit = value => {
    if (Array.isArray(value) && typeof value[0] === "number") { xs.push(value[0]); ys.push(value[1]); return; }
    if (Array.isArray(value)) value.forEach(visit);
  };
  collection.features.forEach(f => visit(f.geometry.coordinates));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
function planarPath(geometry, project) {
  const ring = points => "M" + points.map(project).join("L") + "Z";
  if (geometry.type === "Polygon") return geometry.coordinates.map(r => ring(r)).join("");
  return geometry.coordinates.map(poly => poly.map(r => ring(r)).join("")).join("");
}

function showProvince(name) {
  card.innerHTML = `<p class="card-label">省级行政区</p><h2>${name}</h2><p>${copy[name] || "这片土地有着独特的自然风貌、历史记忆与当代活力。"}</p>`;
}
function draw(data) {
  mapRoot.selectAll("*").remove();
  const width = mapRoot.node().clientWidth - 24, height = 760;
  svg = mapRoot.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");
  group = svg.append("g");
  const bounds = boundsOf(data);
  const scale = Math.min((width - 36) / (bounds.maxX - bounds.minX), (height - 36) / (bounds.maxY - bounds.minY));
  const usedWidth = (bounds.maxX - bounds.minX) * scale, usedHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = (width - usedWidth) / 2, offsetY = (height - usedHeight) / 2;
  const project = ([lon, lat]) => {
    const x = offsetX + (lon - bounds.minX) * scale;
    const y = height - offsetY - (lat - bounds.minY) * scale;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  const regions = group.selectAll("path").data(data.features).join("path")
    .attr("class", "province").attr("d", d => planarPath(d.geometry, project))
    .attr("fill", (d, i) => palette[i % palette.length])
    .attr("tabindex", 0).attr("aria-label", d => d.properties.name)
    .on("mouseenter focus", function (_, d) { d3.select(this).classed("is-active", true); showProvince(d.properties.name); })
    .on("mouseleave blur", function () { d3.select(this).classed("is-active", false); });
  zoomBehavior = d3.zoom().scaleExtent([1, 5]).on("zoom", e => group.attr("transform", e.transform));
  svg.call(zoomBehavior);
}

fetch(GEOJSON_URL).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(normalizeWinding).then(draw).catch(() => {
  mapRoot.html('<div class="map-loading">地图服务暂不可用，请检查网络后刷新页面。</div>');
});
document.querySelector("#reset-map").addEventListener("click", () => svg && svg.transition().duration(450).call(zoomBehavior.transform, d3.zoomIdentity));

fetch("data/world.json")
  .then(r => r.json())
  .then(world => {
    const root = d3.select("#world-map");
    const width = root.node().clientWidth || 520, height = 220;
    const projection = d3.geoNaturalEarth1().fitExtent([[4, 5], [width - 4, height - 5]], { type: "Sphere" });
    const worldPath = d3.geoPath(projection);
    const countries = topojson.feature(world, world.objects.countries).features;
    const china = countries.find(d => String(d.id) === "156");
    const view = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    view.append("path").datum({ type: "Sphere" }).attr("d", worldPath).attr("fill", "#40332f");
    view.selectAll(".world-land").data(countries).join("path").attr("class", "world-land").attr("d", worldPath);
    if (china) view.append("path").datum(china).attr("class", "world-china").attr("d", worldPath);
  });
