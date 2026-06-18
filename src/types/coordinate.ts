/**
 * 坐标系类型定义
 */

/** 支持的坐标系类型 */
export type CoordinateSystem = "WGS84" | "CGCS2000" | "GCJ02" | "BD09";

/** 经纬度坐标对 */
export interface LngLat {
  /** 经度 (-180 ~ 180) */
  lng: number;
  /** 纬度 (-90 ~ 90) */
  lat: number;
}

/** 坐标系描述信息 */
export interface CoordinateSystemInfo {
  value: CoordinateSystem;
  label: string;
  description: string;
}

/** 单条转换结果 */
export interface ConversionResult {
  /** 原始经度 */
  sourceLng: number;
  /** 原始纬度 */
  sourceLat: number;
  /** 转换后经度 */
  targetLng: number;
  /** 转换后纬度 */
  targetLat: number;
  /** 转换前坐标 (地图展示用) */
  sourcePoint: LngLat;
  /** 转换后坐标 (地图展示用) */
  targetPoint: LngLat;
}

/** 坐标系选项列表 */
export const COORDINATE_SYSTEMS: CoordinateSystemInfo[] = [
  {
    value: "WGS84",
    label: "WGS-84",
    description: "GPS原始坐标系，国际标准",
  },
  {
    value: "CGCS2000",
    label: "CGCS2000",
    description: "国家大地坐标系2000",
  },
  {
    value: "GCJ02",
    label: "GCJ-02",
    description: "火星坐标系，高德/腾讯地图",
  },
  {
    value: "BD09",
    label: "BD-09",
    description: "百度坐标系",
  },
];

/** 根据坐标系value获取label */
export function getSystemLabel(value: CoordinateSystem): string {
  const info = COORDINATE_SYSTEMS.find((s) => s.value === value);
  return info ? info.label : value;
}
