/**
 * 坐标系转换核心算法
 *
 * 支持的坐标系:
 * - WGS-84: GPS原始坐标系
 * - CGCS2000: 国家大地坐标系2000
 * - GCJ-02: 火星坐标系 (国测局加密)
 * - BD-09: 百度坐标系
 *
 * 转换关系链:
 *   WGS-84 <--> GCJ-02 <--> BD-09
 *   WGS-84 <--> CGCS2000 (近似等同，椭球参数差异约 0.11mm)
 *   CGCS2000 通过 WGS-84 中转至 GCJ-02 / BD-09
 *
 * @module coordinateTransform
 */

import type { CoordinateSystem, LngLat } from "../types/coordinate";

// ============================================================
// 常量定义
// ============================================================

/** 圆周率 */
const PI: number = 3.1415926535897932384626;

/** 克拉索夫斯基椭球长半轴 (米) */
const A: number = 6378245.0;

/** 克拉索夫斯基椭球扁率的平方 */
const EE: number = 0.00669342162296594323;

/** 百度偏移算法使用的常量 */
const X_PI: number = (PI * 3000.0) / 180.0;

// ============================================================
// 辅助函数
// ============================================================

/**
 * 判断坐标是否在中国境外
 * 中国境外不进行GCJ-02加密偏移
 *
 * @param lng 经度
 * @param lat 纬度
 * @returns true表示在境外，不偏移
 */
function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/**
 * 纬度变换辅助函数
 * GCJ-02加密算法核心部分
 *
 * @param lng 经度
 * @param lat 纬度
 * @returns 变换后的纬度偏移量
 */
function transformLat(lng: number, lat: number): number {
  let ret: number =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

/**
 * 经度变换辅助函数
 * GCJ-02加密算法核心部分
 *
 * @param lng 经度
 * @param lat 纬度
 * @returns 变换后的经度偏移量
 */
function transformLng(lng: number, lat: number): number {
  let ret: number =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((lng / 12.0) * PI) +
      300.0 * Math.sin((lng / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
}

// ============================================================
// 基础转换函数 (两两直接转换)
// ============================================================

/**
 * WGS-84 -> GCJ-02
 * 国测局加密算法，将GPS原始坐标转换为火星坐标系
 *
 * @param lng WGS-84经度
 * @param lat WGS-84纬度
 * @returns [GCJ-02经度, GCJ-02纬度]
 */
export function wgs84togcj02(lng: number, lat: number): [number, number] {
  // 中国境外不偏移
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }

  let dLat: number = transformLat(lng - 105.0, lat - 35.0);
  let dLng: number = transformLng(lng - 105.0, lat - 35.0);
  const radLat: number = (lat / 180.0) * PI;
  let magic: number = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic: number = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  const mgLat: number = lat + dLat;
  const mgLng: number = lng + dLng;

  return [mgLng, mgLat];
}

/**
 * GCJ-02 -> WGS-84
 * 国测局解密算法，将火星坐标系转换回GPS原始坐标
 * 使用迭代逼近法（单次偏移反向计算，精度足够用于常规应用）
 *
 * @param lng GCJ-02经度
 * @param lat GCJ-02纬度
 * @returns [WGS-84经度, WGS-84纬度]
 */
export function gcj02towgs84(lng: number, lat: number): [number, number] {
  // 中国境外不偏移
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }

  // 使用正向偏移反向推导
  let dLat: number = transformLat(lng - 105.0, lat - 35.0);
  let dLng: number = transformLng(lng - 105.0, lat - 35.0);
  const radLat: number = (lat / 180.0) * PI;
  let magic: number = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic: number = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  // 反向计算：原始坐标 = 加密坐标 - 偏移量
  // 注意：由于偏移量是基于加密后坐标附近计算的，这里做一次迭代修正
  const wgsLat: number = lat - dLat;
  const wgsLng: number = lng - dLng;

  // 二次迭代提升精度
  const [correctedLng, correctedLat] = wgs84togcj02(wgsLng, wgsLat);
  const finalLng: number = wgsLng - (correctedLng - lng);
  const finalLat: number = wgsLat - (correctedLat - lat);

  return [finalLng, finalLat];
}

/**
 * GCJ-02 -> BD-09
 * 百度坐标系偏移算法，将火星坐标系转换为百度坐标系
 *
 * @param lng GCJ-02经度
 * @param lat GCJ-02纬度
 * @returns [BD-09经度, BD-09纬度]
 */
export function gcj02tobd09(lng: number, lat: number): [number, number] {
  const z: number = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta: number = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  const bdLng: number = z * Math.cos(theta) + 0.0065;
  const bdLat: number = z * Math.sin(theta) + 0.006;
  return [bdLng, bdLat];
}

/**
 * BD-09 -> GCJ-02
 * 百度坐标系逆向偏移，将百度坐标系转换回火星坐标系
 *
 * @param lng BD-09经度
 * @param lat BD-09纬度
 * @returns [GCJ-02经度, GCJ-02纬度]
 */
export function bd09togcj02(lng: number, lat: number): [number, number] {
  const x: number = lng - 0.0065;
  const y: number = lat - 0.006;
  const z: number = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta: number = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  const gcjLng: number = z * Math.cos(theta);
  const gcjLat: number = z * Math.sin(theta);
  return [gcjLng, gcjLat];
}

/**
 * WGS-84 -> BD-09
 * 通过GCJ-02中转: WGS-84 -> GCJ-02 -> BD-09
 *
 * @param lng WGS-84经度
 * @param lat WGS-84纬度
 * @returns [BD-09经度, BD-09纬度]
 */
export function wgs84tobd09(lng: number, lat: number): [number, number] {
  const [gcjLng, gcjLat] = wgs84togcj02(lng, lat);
  return gcj02tobd09(gcjLng, gcjLat);
}

/**
 * BD-09 -> WGS-84
 * 通过GCJ-02中转: BD-09 -> GCJ-02 -> WGS-84
 *
 * @param lng BD-09经度
 * @param lat BD-09纬度
 * @returns [WGS-84经度, WGS-84纬度]
 */
export function bd09towgs84(lng: number, lat: number): [number, number] {
  const [gcjLng, gcjLat] = bd09togcj02(lng, lat);
  return gcj02towgs84(gcjLng, gcjLat);
}

// ============================================================
// CGCS2000 转换函数
// ============================================================

/**
 * WGS-84 -> CGCS2000
 * WGS-84与CGCS2000椭球参数差异极小（约0.11mm），
 * 实际应用中视为等同，直接返回原值。
 * 此处保留接口以支持完整转换链。
 *
 * @param lng WGS-84经度
 * @param lat WGS-84纬度
 * @returns [CGCS2000经度, CGCS2000纬度]
 */
export function wgs84tocgcs2000(lng: number, lat: number): [number, number] {
  // WGS-84 与 CGCS2000 椭球参数差异在亚毫米级，实际应用中等同
  return [lng, lat];
}

/**
 * CGCS2000 -> WGS-84
 * 与正向转换同理，直接返回原值。
 *
 * @param lng CGCS2000经度
 * @param lat CGCS2000纬度
 * @returns [WGS-84经度, WGS-84纬度]
 */
export function cgcs2000towgs84(lng: number, lat: number): [number, number] {
  return [lng, lat];
}

/**
 * CGCS2000 -> GCJ-02
 * 通过WGS-84中转: CGCS2000 -> WGS-84 -> GCJ-02
 *
 * @param lng CGCS2000经度
 * @param lat CGCS2000纬度
 * @returns [GCJ-02经度, GCJ-02纬度]
 */
export function cgcs2000togcj02(lng: number, lat: number): [number, number] {
  const [wgsLng, wgsLat] = cgcs2000towgs84(lng, lat);
  return wgs84togcj02(wgsLng, wgsLat);
}

/**
 * GCJ-02 -> CGCS2000
 * 通过WGS-84中转: GCJ-02 -> WGS-84 -> CGCS2000
 *
 * @param lng GCJ-02经度
 * @param lat GCJ-02纬度
 * @returns [CGCS2000经度, CGCS2000纬度]
 */
export function gcj02tocgcs2000(lng: number, lat: number): [number, number] {
  const [wgsLng, wgsLat] = gcj02towgs84(lng, lat);
  return wgs84tocgcs2000(wgsLng, wgsLat);
}

/**
 * CGCS2000 -> BD-09
 * 通过WGS-84和GCJ-02中转: CGCS2000 -> WGS-84 -> GCJ-02 -> BD-09
 *
 * @param lng CGCS2000经度
 * @param lat CGCS2000纬度
 * @returns [BD-09经度, BD-09纬度]
 */
export function cgcs2000tobd09(lng: number, lat: number): [number, number] {
  const [wgsLng, wgsLat] = cgcs2000towgs84(lng, lat);
  return wgs84tobd09(wgsLng, wgsLat);
}

/**
 * BD-09 -> CGCS2000
 * 通过GCJ-02和WGS-84中转: BD-09 -> GCJ-02 -> WGS-84 -> CGCS2000
 *
 * @param lng BD-09经度
 * @param lat BD-09纬度
 * @returns [CGCS2000经度, CGCS2000纬度]
 */
export function bd09tocgcs2000(lng: number, lat: number): [number, number] {
  const [wgsLng, wgsLat] = bd09towgs84(lng, lat);
  return wgs84tocgcs2000(wgsLng, wgsLat);
}

// ============================================================
// 通用转换入口
// ============================================================

/**
 * 通用坐标系转换函数
 * 支持任意两个坐标系之间的转换（共12种方向）
 *
 * 转换路由表:
 * - WGS84 <-> GCJ02: 直接转换
 * - GCJ02 <-> BD09: 直接转换
 * - WGS84 <-> BD09: 通过GCJ02中转
 * - WGS84 <-> CGCS2000: 近似等同
 * - CGCS2000 <-> GCJ02: 通过WGS84中转
 * - CGCS2000 <-> BD09: 通过WGS84+GCJ02中转
 * - 同坐标系: 原值返回
 *
 * @param lng 源经度
 * @param lat 源纬度
 * @param from 源坐标系
 * @param to 目标坐标系
 * @returns [目标经度, 目标纬度]
 */
export function convert(
  lng: number,
  lat: number,
  from: CoordinateSystem,
  to: CoordinateSystem
): [number, number] {
  // 同坐标系，直接返回
  if (from === to) {
    return [lng, lat];
  }

  // 根据源/目标坐标系选择对应的转换函数
  switch (from) {
    case "WGS84":
      switch (to) {
        case "GCJ02":
          return wgs84togcj02(lng, lat);
        case "BD09":
          return wgs84tobd09(lng, lat);
        case "CGCS2000":
          return wgs84tocgcs2000(lng, lat);
        default:
          return [lng, lat];
      }

    case "GCJ02":
      switch (to) {
        case "WGS84":
          return gcj02towgs84(lng, lat);
        case "BD09":
          return gcj02tobd09(lng, lat);
        case "CGCS2000":
          return gcj02tocgcs2000(lng, lat);
        default:
          return [lng, lat];
      }

    case "BD09":
      switch (to) {
        case "WGS84":
          return bd09towgs84(lng, lat);
        case "GCJ02":
          return bd09togcj02(lng, lat);
        case "CGCS2000":
          return bd09tocgcs2000(lng, lat);
        default:
          return [lng, lat];
      }

    case "CGCS2000":
      switch (to) {
        case "WGS84":
          return cgcs2000towgs84(lng, lat);
        case "GCJ02":
          return cgcs2000togcj02(lng, lat);
        case "BD09":
          return cgcs2000tobd09(lng, lat);
        default:
          return [lng, lat];
      }

    default:
      return [lng, lat];
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 保留指定小数位数
 *
 * @param value 数值
 * @param digits 小数位数 (默认6)
 * @returns 格式化后的数值
 */
export function roundCoordinate(value: number, digits: number = 6): number {
  const factor: number = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/**
 * 解析单行文本坐标
 * 支持逗号分隔或空格分隔
 *
 * @param line 文本行，如 "116.404,39.915" 或 "116.404 39.915"
 * @returns 解析后的坐标或null
 */
export function parseCoordinateLine(line: string): LngLat | null {
  const trimmed: string = line.trim();
  if (!trimmed) {
    return null;
  }

  // 支持逗号、空格、制表符分隔
  const parts: string[] = trimmed.split(/[\s,，\t]+/).filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }

  const lng: number = parseFloat(parts[0]);
  const lat: number = parseFloat(parts[1]);

  if (isNaN(lng) || isNaN(lat)) {
    return null;
  }

  return { lng, lat };
}

/**
 * 批量解析多行文本坐标
 *
 * @param text 多行文本
 * @returns 解析后的坐标数组
 */
export function parseCoordinates(text: string): LngLat[] {
  const lines: string[] = text.split("\n");
  const results: LngLat[] = [];

  for (const line of lines) {
    const coord: LngLat | null = parseCoordinateLine(line);
    if (coord) {
      results.push(coord);
    }
  }

  return results;
}

/**
 * 验证经纬度是否在合理范围内
 *
 * @param lng 经度
 * @param lat 纬度
 * @returns 是否有效
 */
export function isValidCoordinate(lng: number, lat: number): boolean {
  return (
    !isNaN(lng) &&
    !isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * 格式化坐标为字符串
 *
 * @param lng 经度
 * @param lat 纬度
 * @param digits 小数位数 (默认6)
 * @returns 格式化字符串 "lng, lat"
 */
export function formatCoordinate(lng: number, lat: number, digits: number = 6): string {
  return `${roundCoordinate(lng, digits).toFixed(digits)}, ${roundCoordinate(lat, digits).toFixed(digits)}`;
}

/**
 * 解析单行文本坐标（支持经纬度顺序切换）
 * 支持逗号分隔或空格分隔
 *
 * @param line 文本行，如 "116.404,39.915" 或 "116.404 39.915"
 * @param lngFirst true表示先经度后纬度，false表示先纬度后经度
 * @returns 解析后的坐标或null
 */
export function parseCoordinateLineOrdered(
  line: string,
  lngFirst: boolean
): LngLat | null {
  const trimmed: string = line.trim();
  if (!trimmed) {
    return null;
  }

  const parts: string[] = trimmed
    .split(/[\s,，\t]+/)
    .filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }

  const first: number = parseFloat(parts[0]);
  const second: number = parseFloat(parts[1]);

  if (isNaN(first) || isNaN(second)) {
    return null;
  }

  if (lngFirst) {
    return { lng: first, lat: second };
  }
  return { lng: second, lat: first };
}

/**
 * 批量解析多行文本坐标（支持经纬度顺序切换）
 *
 * @param text 多行文本
 * @param lngFirst true表示先经度后纬度，false表示先纬度后经度
 * @returns 解析后的坐标数组
 */
export function parseCoordinatesOrdered(
  text: string,
  lngFirst: boolean
): LngLat[] {
  const lines: string[] = text.split("\n");
  const results: LngLat[] = [];

  for (const line of lines) {
    const coord: LngLat | null = parseCoordinateLineOrdered(line, lngFirst);
    if (coord) {
      results.push(coord);
    }
  }

  return results;
}

/**
 * 格式化坐标为字符串（支持经纬度顺序切换）
 *
 * @param lng 经度
 * @param lat 纬度
 * @param lngFirst true表示先经度后纬度，false表示先纬度后经度
 * @param digits 小数位数 (默认6)
 * @returns 格式化字符串
 */
export function formatCoordinateOrdered(
  lng: number,
  lat: number,
  lngFirst: boolean,
  digits: number = 6
): string {
  if (lngFirst) {
    return `${roundCoordinate(lng, digits).toFixed(digits)}, ${roundCoordinate(lat, digits).toFixed(digits)}`;
  }
  return `${roundCoordinate(lat, digits).toFixed(digits)}, ${roundCoordinate(lng, digits).toFixed(digits)}`;
}
