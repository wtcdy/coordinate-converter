/**
 * 百度地图容器组件
 *
 * 封装百度地图 JS API (window.BMap) 为 React 组件，
 * 替代 Leaflet 直接瓦片加载方式（百度瓦片 URL 存在 SSL 证书问题）。
 *
 * 百度地图 JS API 原生使用 BD-09 坐标系，
 * 所有传入的坐标应已通过 alignToTile 转换为 BD-09。
 *
 * 支持两种模式：
 * - 单点模式：显示 sourcePoint(蓝) + targetPoint(红) + 连线
 * - 多点模式：显示 points 数组中所有点（红点）
 */

import { useEffect, useRef, useCallback } from "react";
import type { LngLat, CoordinateSystem } from "../types/coordinate";
import { convert } from "../utils/coordinateTransform";
import type { MapPointItem } from "./MapPreview";

/** 百度地图 JS API 全局对象类型声明 */
declare global {
  interface Window {
    BMap: any;
    BMAP_Symbol_SHAPE_POINT: number;
  }
}

interface BaiduMapContainerProps {
  /** 转换前坐标（单点模式） */
  sourcePoint?: LngLat | null;
  /** 转换后坐标（单点模式） */
  targetPoint?: LngLat | null;
  /** 源坐标系名称 */
  sourceLabel?: string;
  /** 目标坐标系名称 */
  targetLabel?: string;
  /** 多点模式：显示多个标记 */
  points?: MapPointItem[];
  /** 目标坐标系 */
  targetSystem?: CoordinateSystem;
  /** 源坐标系 */
  sourceSystem?: CoordinateSystem;
  /** 是否可见（用于控制 display 显隐） */
  visible: boolean;
}

/**
 * 将坐标转换到 BD-09 坐标系（百度地图原生坐标系）
 *
 * @param lng 经度
 * @param lat 纬度
 * @param sourceSystem 坐标原始所在坐标系
 * @returns 转换后的 [经度, 纬度] (BD-09)
 */
function alignToBd09(
  lng: number,
  lat: number,
  sourceSystem: CoordinateSystem | undefined
): [number, number] {
  if (!sourceSystem) {
    return [lng, lat];
  }
  if (sourceSystem === "BD09") {
    return [lng, lat];
  }
  return convert(lng, lat, sourceSystem, "BD09");
}

/**
 * 等待百度地图 JS API 加载完成
 *
 * 百度地图脚本通过 index.html 的 <script> 标签异步加载，
 * 需要等待 window.BMap 可用后才能初始化地图。
 *
 * @param timeout 超时时间（毫秒），默认 10 秒
 * @returns Promise<void>
 */
function waitForBMap(timeout: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.BMap) {
      resolve();
      return;
    }

    const startTime: number = Date.now();

    const check = (): void => {
      if (window.BMap) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("百度地图 JS API 加载超时"));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

/**
 * 百度地图容器组件
 *
 * 使用百度地图 JS API 渲染地图，支持单点模式和多点模式。
 * 组件通过 CSS display 属性控制可见性，避免重复初始化。
 */
export default function BaiduMapContainer({
  sourcePoint = null,
  targetPoint = null,
  sourceLabel = "源坐标",
  targetLabel = "目标坐标",
  points,
  targetSystem,
  sourceSystem,
  visible,
}: BaiduMapContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const initAttemptedRef = useRef<boolean>(false);

  /** 是否为多点模式 */
  const isBatchMode: boolean = !!points && points.length > 0;

  /** 构建弹窗 HTML 内容 */
  const buildInfoWindowContent = useCallback(
    (label: string, lng: number, lat: number): string => {
      return `<div style="font-size:12px;line-height:1.6;">${label}<br/>经度: ${lng.toFixed(6)}<br/>纬度: ${lat.toFixed(6)}<br/><span style="color:#888;font-size:11px;">百度地图 (BD-09)</span></div>`;
    },
    []
  );

  /** 清除所有覆盖物 */
  const clearOverlays = useCallback((): void => {
    const map = mapRef.current;
    if (!map) return;

    overlaysRef.current.forEach((overlay) => {
      map.removeOverlay(overlay);
    });
    overlaysRef.current = [];
  }, []);

  /** 初始化百度地图 */
  useEffect(() => {
    if (!containerRef.current || mapRef.current || initAttemptedRef.current) return;

    initAttemptedRef.current = true;

    const initMap = async (): Promise<void> => {
      try {
        await waitForBMap();
      } catch {
        console.error("百度地图 JS API 加载失败，地图功能不可用");
        return;
      }

      if (!containerRef.current || mapRef.current) return;

      const BMap = window.BMap;
      const map = new BMap.Map(containerRef.current);
      map.centerAndZoom(new BMap.Point(116.404, 39.915), 10);
      map.enableScrollWheelZoom(true);

      // 添加缩放控件
      map.addControl(new BMap.NavigationControl());
      map.addControl(new BMap.ScaleControl());

      mapRef.current = map;
    };

    initMap();
  }, []);

  /** 更新覆盖物（标记、连线） */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.BMap) return;

    clearOverlays();

    const BMap = window.BMap;
    const viewPoints: any[] = [];

    if (isBatchMode && points) {
      // 多点模式：遍历 points，每个点创建红色小圆点标记
      points.forEach((pt, index) => {
        const [alignedLng, alignedLat] = alignToBd09(pt.lng, pt.lat, targetSystem);
        const point = new BMap.Point(alignedLng, alignedLat);
        const label: string = pt.label || `点${index + 1}`;

        const marker = new BMap.Marker(point, {
          icon: new BMap.Icon(
            "data:image/svg+xml;base64," +
              btoa(
                '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#d32f2f" stroke="white" stroke-width="1.5"/></svg>'
              ),
            new BMap.Size(10, 10),
            { anchor: new BMap.Size(5, 5) }
          ),
        });

        const infoWindow = new BMap.InfoWindow(
          buildInfoWindowContent(label, alignedLng, alignedLat)
        );
        marker.addEventListener("click", () => {
          map.openInfoWindow(infoWindow, point);
        });

        map.addOverlay(marker);
        overlaysRef.current.push(marker);
        viewPoints.push(point);
      });
    } else {
      // 单点模式：显示 sourcePoint(蓝) + targetPoint(红) + 连线

      // 源坐标标记（蓝色圆点）
      if (sourcePoint) {
        const [alignedLng, alignedLat] = alignToBd09(
          sourcePoint.lng,
          sourcePoint.lat,
          sourceSystem
        );
        const point = new BMap.Point(alignedLng, alignedLat);

        const marker = new BMap.Marker(point, {
          icon: new BMap.Icon(
            "data:image/svg+xml;base64," +
              btoa(
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#1976d2" stroke="white" stroke-width="2"/></svg>'
              ),
            new BMap.Size(16, 16),
            { anchor: new BMap.Size(8, 8) }
          ),
        });

        const infoWindow = new BMap.InfoWindow(
          buildInfoWindowContent(sourceLabel, alignedLng, alignedLat)
        );
        marker.addEventListener("click", () => {
          map.openInfoWindow(infoWindow, point);
        });

        map.addOverlay(marker);
        overlaysRef.current.push(marker);
        viewPoints.push(point);
      }

      // 目标坐标标记（红色圆点）
      if (targetPoint) {
        const [alignedLng, alignedLat] = alignToBd09(
          targetPoint.lng,
          targetPoint.lat,
          targetSystem
        );
        const point = new BMap.Point(alignedLng, alignedLat);

        const marker = new BMap.Marker(point, {
          icon: new BMap.Icon(
            "data:image/svg+xml;base64," +
              btoa(
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#d32f2f" stroke="white" stroke-width="2"/></svg>'
              ),
            new BMap.Size(16, 16),
            { anchor: new BMap.Size(8, 8) }
          ),
        });

        const infoWindow = new BMap.InfoWindow(
          buildInfoWindowContent(targetLabel, alignedLng, alignedLat)
        );
        marker.addEventListener("click", () => {
          map.openInfoWindow(infoWindow, point);
        });

        map.addOverlay(marker);
        overlaysRef.current.push(marker);
        viewPoints.push(point);
      }

      // 连线（源 → 目标 虚线）
      if (sourcePoint && targetPoint) {
        const [srcLng, srcLat] = alignToBd09(
          sourcePoint.lng,
          sourcePoint.lat,
          sourceSystem
        );
        const [tgtLng, tgtLat] = alignToBd09(
          targetPoint.lng,
          targetPoint.lat,
          targetSystem
        );

        const polyline = new BMap.Polyline(
          [new BMap.Point(srcLng, srcLat), new BMap.Point(tgtLng, tgtLat)],
          {
            strokeColor: "#9e9e9e",
            strokeWeight: 2,
            strokeOpacity: 0.7,
            strokeStyle: "dashed",
          }
        );

        map.addOverlay(polyline);
        overlaysRef.current.push(polyline);
      }
    }

    // 自动调整视野
    if (viewPoints.length === 1) {
      map.centerAndZoom(viewPoints[0], 12);
    } else if (viewPoints.length > 1) {
      map.setViewport(viewPoints, { margins: [60, 60, 60, 60] });
    }
  }, [
    sourcePoint,
    targetPoint,
    sourceLabel,
    targetLabel,
    points,
    isBatchMode,
    targetSystem,
    sourceSystem,
    clearOverlays,
    buildInfoWindowContent,
  ]);

  /** 可见性变化时刷新地图尺寸 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;

    // 延迟刷新以确保 display 切换后 DOM 更新完成
    const timer = setTimeout(() => {
      map.reset();
    }, 50);

    return () => clearTimeout(timer);
  }, [visible]);

  /** 组件卸载时清理地图 */
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map) {
        map.clearOverlays();
        map.disableScrollWheelZoom();
        mapRef.current = null;
      }
      overlaysRef.current = [];
      initAttemptedRef.current = false;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: visible ? "block" : "none",
        minHeight: isBatchMode ? "400px" : "250px",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    />
  );
}
