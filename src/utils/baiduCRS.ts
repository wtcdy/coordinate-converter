/**
 * 百度地图自定义坐标系 (BD-09 CRS)
 *
 * 百度地图使用 BD-09 坐标系，其 Mercator 投影与标准 EPSG:3857 有显著差异。
 * 本模块提供：
 * 1. BD-09 经纬度 <-> 百度墨卡托坐标的多项式转换函数
 * 2. 自定义 L.CRS.Baidu 坐标系对象，用于 Leaflet 地图
 *
 * ## 百度投影与标准 Web Mercator 的关键差异：
 *
 * 1. **坐标原点偏移**: 百度的墨卡托坐标原点与标准不同
 * 2. **多项式拟合**: 百度使用分段多项式拟合代替标准球面墨卡托公式
 * 3. **Y轴翻转**: 百度瓦片使用 TMS 方式的瓦片索引（y轴从下往上递增）
 * 4. **缩放级别**: 百度的 zoom 与标准相同 (0~19)，但地图初始状态不同
 *
 * @module baiduCRS
 */

import L from "leaflet";

// ============================================================
// 多项式系数常量（来自百度地图 JS API v2/v3 源码）
// 每行 10 个系数：百度官方完整格式
// ============================================================

/**
 * 纬度分界带 - 用于选择合适的拟合系数组
 *
 * 当 |latitude| 大于等于对应值时，使用该索引的系数组
 * 数值递减：75° -> 60° -> 45° -> 30° -> 15° -> 0°
 */
const LLBAND: number[] = [75, 60, 45, 30, 15, 0];

/**
 * BD-09 经纬度 -> 百度墨卡托 (LL2MC) 的多项式系数
 *
 * 每行包含 10 个系数: [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9]
 * - c0, c1: x方向线性变换系数（result_x = (c0 + c1*|lng|) * sign(lng)）
 * - c2~c8: y方向6阶多项式系数
 * - c9: y方向归一化除数（cC = |lat| / c9）
 */
const LL2MC: number[][] = [
  [-0.0015702102444, 111320.7020616939, 1704480524535203, -10338987376042340, 26112667856603880, -35149669176653700, 26595700718403920, -10725012454188240, 1800819912950474, 82.5],
  [0.0008277824516172526, 111320.7020463578, 647795574.6671607, -4082003173.641316, 10774905663.51142, -15171875531.51559, 12053065338.62167, -5124939663.577472, 913311935.9512032, 67.5],
  [0.00337398766765, 111320.7020202162, 4481351.045890365, -23393751.19931662, 79682215.47186455, -115964993.2797253, 97236711.15602145, -43661946.33752821, 8477230.501135234, 52.5],
  [0.00220636496208, 111320.7020209128, 51751.86112841131, 3796837.749470245, 992013.7397791013, -1221952.21711287, 1340652.697009075, -620943.6990984312, 144416.9293806241, 37.5],
  [-0.0003441963504368392, 111320.7020576856, 278.2353980772752, 2485758.690035394, 6070.750963243378, 54821.18345352118, 9540.606633304236, -2710.55326746645, 1405.483844121726, 22.5],
  [-0.0003218135878613132, 111320.7020701615, 0.00369383431289, 823725.6402795718, 0.46104986909093, 2351.343141331292, 1.58060784298199, 8.77738589078284, 0.37238884252424, 7.45]
];

/**
 * 墨卡托坐标分界带 - 用于 MC2LL 转换时的系数选择
 *
 * 当 |mercator_y| 大于等于对应值时，使用该索引的系数组
 */
const MCBAND: number[] = [12890594.86, 8362377.87, 5591025.0, 3481989.83, 1678043.12, 0];

/**
 * 百度墨卡托 -> BD-09 经纬度 (MC2LL) 的多项式系数
 *
 * 每行包含 10 个系数: [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9]
 * - c0, c1: x方向线性变换系数（result_x = (c0 + c1*|mx|) * sign(mx)）
 * - c2~c8: y方向6阶多项式系数
 * - c9: y方向归一化除数（cC = |my| / c9）
 */
const MC2LL: number[][] = [
  [1.410526172116255e-8, 0.00000898305509648872, -1.9939833816331, 200.9824383106796, -187.2403703815547, 91.6087516669843, -23.38765649603339, 2.57121317296198, -0.03801003308653, 17337981.2],
  [-7.435856389565537e-9, 0.000008983055097726239, -0.78625201886289, 96.32687599759846, -1.85204757529826, -59.36935905485877, 47.40033549296737, -16.50741931063887, 2.28786674699375, 10260144.86],
  [-3.030883460898826e-8, 0.00000898305509983578, 0.30071316287616, 59.74293618442277, 7.357984074871, -25.38371002664745, 13.45380521110908, -3.29883767235584, 0.32710905363475, 6856817.37],
  [-1.981981304930552e-8, 0.000008983055099779535, 0.03278182852591, 40.31678527705744, 0.65659298677277, -4.44255534477492, 0.85341911805263, 0.12923347998204, -0.04625736007561, 4482777.06],
  [3.09191371068437e-9, 0.000008983055096812155, 0.00006995724062, 23.10934304144901, -0.00023663490511, -0.6321817810242, -0.00663494467273, 0.03430082397953, -0.00466043876332, 2555164.4],
  [2.890871144776878e-9, 0.000008983055095805407, -3.068298e-8, 7.47137025468032, -0.00000353937994, -0.02145144861037, -0.00001234426596, 0.00010322952773, -0.00000323890364, 826088.5]
];

// ============================================================
// 核心转换函数
// ============================================================

/**
 * 百度多项式拟合转换核心函数
 *
 * 使用百度官方的分段多项式算法同时计算 x 和 y 两个方向的转换结果。
 *
 * 公式结构（每行10个系数 c[0]~c[9]）：
 * ```
 * // x 方向：线性变换
 * T = c[0] + c[1] * |x|
 * result_x = T * sign(x)
 *
 * // y 方向：归一化 + 6阶多项式
 * cC = |y| / c[9]
 * cE = c[2] + c[3]*cC + c[4]*cC² + c[5]*cC³ + c[6]*cC⁴ + c[7]*cC⁵ + c[8]*cC⁶
 * result_y = cE * sign(y)
 * ```
 *
 * x 方向使用线性公式（经度/墨卡托x 的线性变换），
 * y 方向使用归一化后的 6 阶多项式（纬度/墨卡托y 的非线性拟合）。
 *
 * @param x 第一个坐标分量（LL2MC时为经度，MC2LL时为墨卡托x）
 * @param y 第二个坐标分量（LL2MC时为纬度，MC2LL时为墨卡托y），同时用于选择系数带
 * @param factors 多项式系数数组（每行10个系数）
 * @param bands 分界带数组
 * @returns [转换后的x, 转换后的y]
 */
function convertor(
  x: number,
  y: number,
  factors: number[][],
  bands: number[]
): [number, number] {
  // 根据 |y| 选择对应的系数带
  const absY: number = Math.abs(y);
  let factor: number[] | null = null;
  for (let i = 0; i < bands.length; i++) {
    if (absY >= bands[i]) {
      factor = factors[i];
      break;
    }
  }

  // 若未匹配到任何带，使用最后一组（最低纬度带）作为默认
  if (!factor) {
    factor = factors[factors.length - 1];
  }

  const c: number[] = factor;

  // x 方向：线性公式
  // T = c[0] + c[1] * |x|
  const T: number = c[0] + c[1] * Math.abs(x);

  // y 方向：归一化因子
  // cC = |y| / c[9]
  const cC: number = absY / c[9];

  // y 方向：6阶多项式
  // cE = c[2] + c[3]*cC + c[4]*cC² + c[5]*cC³ + c[6]*cC⁴ + c[7]*cC⁵ + c[8]*cC⁶
  const cE: number =
    c[2] +
    c[3] * cC +
    c[4] * cC * cC +
    c[5] * Math.pow(cC, 3) +
    c[6] * Math.pow(cC, 4) +
    c[7] * Math.pow(cC, 5) +
    c[8] * Math.pow(cC, 6);

  // 恢复符号
  const resultX: number = T * (x < 0 ? -1 : 1);
  const resultY: number = cE * (y < 0 ? -1 : 1);

  return [resultX, resultY];
}

/**
 * BD-09 经纬度转换为百度墨卡托坐标
 *
 * 将 BD-09 坐标系下的经纬度（单位：度）转换为百度自定义的
 * 墨卡托平面坐标（单位：米）。此转换使用百度的分段多项式拟合算法。
 *
 * @param lng BD-09 经度（-180 ~ 180）
 * @param lat BD-09 纬度（-90 ~ 90）
 * @returns [墨卡托 x, 墨卡托 y]，单位：米
 *
 * @example
 * // 北京天安门的 BD-09 坐标
 * const [mx, my] = bd09ToMercator(116.404, 39.915);
 * console.log(mx, my); // ≈ [12958017, 4837123]
 */
export function bd09ToMercator(lng: number, lat: number): [number, number] {
  return convertor(lng, lat, LL2MC, LLBAND);
}

/**
 * 百度墨卡托坐标转换为 BD-09 经纬度
 *
 * 将百度自定义墨卡托平面坐标（单位：米）反向转换为
 * BD-09 坐标系下的经纬度（单位：度）。
 *
 * @param mx 墨卡托 x 坐标（米）
 * @param my 墨卡托 y 坐标（米）
 * @returns [BD-09 经度, BD-09 纬度]
 *
 * @example
 * const [lng, lat] = mercatorToBd09(12958017, 4837123);
 * console.log(lng, lat); // ≈ [116.404, 39.915]
 */
export function mercatorToBd09(mx: number, my: number): [number, number] {
  return convertor(mx, my, MC2LL, MCBAND);
}

// ============================================================
// Leaflet 自定义投影
// ============================================================

/**
 * 百度自定义投影对象
 *
 * 实现了 L.Projection 接口，将 BD-09 经纬度坐标与
 * 百度墨卡托平面坐标之间进行双向转换。
 *
 * bounds 定义了百度墨卡托坐标的有效范围（近似全球范围）
 */
const BaiduProjection = {
  /**
   * 将 BD-09 经纬度投影到百度墨卡托平面坐标
   *
   * @param latlng Leaflet LatLng 对象（BD-09 经纬度）
   * @returns Leaflet Point 对象（墨卡托平面坐标，单位：像素点）
   */
  project: function (latlng: L.LatLng): L.Point {
    const [mcX, mcY]: [number, number] = bd09ToMercator(
      latlng.lng,
      latlng.lat
    );
    return new L.Point(mcX, mcY);
  },

  /**
   * 从百度墨卡托平面坐标反投影为 BD-09 经纬度
   *
   * @param point Leaflet Point 对象（墨卡托平面坐标）
   * @returns Leaflet LatLng 对象（BD-09 经纬度）
   */
  unproject: function (point: L.Point): L.LatLng {
    const [lng, lat]: [number, number] = mercatorToBd09(point.x, point.y);
    return new L.LatLng(lat, lng);
  },

  /**
   * 投影的有效边界范围（百度墨卡托坐标范围）
   * 近似等于 ±20037508 米（标准墨卡托范围）
   */
  bounds: new L.Bounds(
    new L.Point(-20037508.34, -20037508.34),
    new L.Point(20037508.34, 20037508.34)
  ),
};

// ============================================================
// 自定义 CRS 定义
// ============================================================

/**
 * 百度地图自定义坐标系 (L.CRS.Baidu)
 *
 * 基于 L.CRS.Earth 扩展，使用百度的 BD-09 墨卡托投影。
 *
 * ## 关键参数说明（参考 leaflet.ChineseCRS 开源实现）：
 *
 * - **code**: 'BD:09' - 百度坐标系标识符
 * - **projection**: BaiduProjection - BD-09 ↔ 墨卡托双向转换
 * - **transformation**: scale = 2^(-26), offset = 0, Y轴翻转
 *   - pixel = 256 * 2^zoom * (2^(-26) * projected) = 2^(zoom-18) * projected
 *   - 这是百度独有的像素坐标公式：pixel = projected * 2^(zoom-18)
 * - **scale(zoom)**: 256 × 2^zoom（继承自 L.CRS.Earth）
 *
 * ## 与标准 EPSG:3857 的关键区别：
 *
 * | 特性 | EPSG:3857 | BaiduCRS |
 * |------|-----------|----------|
 * | 输入坐标 | WGS-84 经纬度 | BD-09 经纬度 |
 * | 投影公式 | 标准球面墨卡托 | 百度多项式拟合 |
 * | 变换缩放 | 1/(2πR) ≈ 2.49e-8 | 2^(-26) ≈ 1.49e-8 |
 * | 原点偏移 | 0.5（居中） | 0（原点在左上角） |
 * | 瓦片Y坐标 | 标准 XYZ 或 TMS | 自定义取负 (y = -coords.y - 1) |
 */
export const BaiduCRS: L.CRS & {
  code: string;
  projection: typeof BaiduProjection;
} = L.extend({}, L.CRS.Earth, {
  code: "BD:09",

  /** 百度自定义投影 */
  projection: BaiduProjection,

  /**
   * 坐标变换矩阵
   *
   * 百度瓦片像素坐标公式：pixel = projected * 2^(zoom-18)
   * 配合 L.CRS.Earth 的 scale(zoom) = 256 * 2^zoom:
   *   pixel = 256 * 2^zoom * (a * projected + b)
   *   = 256 * 2^zoom * 2^(-26) * projected
   *   = 2^(8 + zoom - 26) * projected
   *   = 2^(zoom - 18) * projected  ✅
   *
   * 参数：
   *   a = 2^(-26) ≈ 1.4901e-8
   *   b = 0（无偏移，原点在投影坐标系的 (0,0) 处）
   *   c = -a（Y轴翻转，使北方在上方）
   *   d = 0
   */
  transformation: (function (): L.Transformation {
    const scale: number = Math.pow(2, -18 - 8); // 2^(-26)
    return new L.Transformation(scale, 0, -scale, 0);
  })(),

  /**
   * 缩放等级到分辨率的映射
   *
   * 在给定 zoom 级别下，每单位投影坐标对应多少像素。
   *
   * 标准 Leaflet 公式：256 × 2^zoom
   * 这意味着每个瓦片是 256×256 像素，
   * 整个世界在 zoom=z 时有 2^z × 2^z 个瓦片
   *
   * @param zoom 缩放等级（0 ~ 18/19）
   * @returns 每单位投影坐标的像素数
   */
  scale: function (zoom: number): number {
    return 256 * Math.pow(2, zoom);
  },

  /**
   * 分辨率到缩放等级的反向映射
   *
   * @param scale 每单位投影坐标的像素数
   * @returns 对应的缩放等级
   */
  zoom: function (scale: number): number {
    return Math.log(scale / 256) / Math.LN2;
  },

  /**
   * 坐标距离计算（两点间大圆弧距离）
   *
   * 使用 Haversine 公式计算地球表面两点间的最短弧距。
   * 注意：此处的坐标应为 BD-09 经纬度。
   *
   * @param latlng1 起点
   * @param latlng2 终点
   * @returns 两点间距离（米）
   */
  distance: function (latlng1: L.LatLng, latlng2: L.LatLng): number {
    const R: number = 6371000; // 地球平均半径（米）
    const radLat1: number = (latlng1.lat * Math.PI) / 180;
    const radLat2: number = (latlng2.lat * Math.PI) / 180;
    const deltaLat: number =
      ((latlng2.lat - latlng1.lat) * Math.PI) / 180;
    const deltaLng: number =
      ((latlng2.lng - latlng1.lng) * Math.PI) / 180;

    const a: number =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(radLat1) *
        Math.cos(radLat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    const c: number = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /** 百度地图支持的纬度范围：约 -74° 到 74° */
  infiniteWorld: false,
}) as L.CRS & { code: string; projection: typeof BaiduProjection };

// ============================================================
// 自定义百度瓦片图层
// ============================================================

/**
 * 百度地图瓦片图层
 *
 * 百度瓦片的 Y 坐标需要取负并偏移1（y = -coords.y - 1），
 * 因为 BaiduCRS 的变换矩阵中 Y 轴被翻转（c = -scale），
 * 导致 Leaflet 内部的 coords.y 对北半球为负值。
 * 取负后恢复为正值，符合百度瓦片服务器的预期。
 *
 * 不使用 tms: true（百度瓦片不是标准 TMS 格式）。
 *
 * 参考：leaflet.ChineseCRS 的 BaiduTileLayer 实现
 */
export const BaiduTileLayer = (L.TileLayer as any).extend({
  getTileUrl: function (coords: { x: number; y: number }): string {
    const data: Record<string, string | number> = {
      r: (L as any).Browser?.retina ? "@2x" : "",
      s: this._getSubdomain(coords),
      x: coords.x,
      y: -coords.y - 1,
      z: this._getZoomForUrl(),
    };
    return L.Util.template(this._url, L.Util.extend(data, this.options));
  },
});

/**
 * 创建百度瓦片图层实例
 *
 * @param url 瓦片 URL 模板
 * @param options Leaflet 瓦片图层选项
 * @returns 百度瓦片图层实例
 */
export function createBaiduTileLayer(
  url: string,
  options: L.TileLayerOptions
): L.TileLayer {
  return new (BaiduTileLayer as any)(url, options) as L.TileLayer;
}

// ============================================================
// 导出工具函数
// ============================================================

/**
 * 检查给定的 CRS 是否为百度坐标系
 *
 * @param crs 要检查的 CRS 对象
 * @returns 如果是百度坐标系则返回 true
 */
export function isBaiduCRS(crs: unknown): boolean {
  return crs === BaiduCRS || (typeof crs === "object" && crs !== null && "code" in crs && (crs as Record<string, unknown>).code === "BD:09");
}
