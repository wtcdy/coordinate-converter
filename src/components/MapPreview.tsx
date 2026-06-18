/**
 * 地图预览组件
 * 使用Leaflet显示转换前后的坐标位置对比
 * 支持OpenStreetMap、腾讯地图和百度地图瓦片切换
 * 支持单点模式（sourcePoint + targetPoint + 连线）和多点模式（points数组）
 * 支持坐标与瓦片对齐：根据当前瓦片坐标系自动转换标记坐标
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import {
  ToggleButton,
  ToggleButtonGroup,
  Box,
  Typography,
} from "@mui/material";
import type { LngLat, CoordinateSystem } from "../types/coordinate";
import { convert } from "../utils/coordinateTransform";
import { BaiduCRS, createBaiduTileLayer } from "../utils/baiduCRS";

/** 地图瓦片类型 */
type MapType = "osm" | "tencent" | "baidu";

/** 多点模式下的点数据 */
export interface MapPointItem {
  lng: number;
  lat: number;
  label?: string;
}

// 修复Leaflet默认图标路径问题
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapPreviewProps {
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
  /** 目标坐标系（用于targetPoint和points的坐标与瓦片对齐） */
  targetSystem?: CoordinateSystem;
  /** 源坐标系（用于sourcePoint的坐标与瓦片对齐） */
  sourceSystem?: CoordinateSystem;
}

// 自定义图标颜色
const blueIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="width: 16px; height: 16px; background: #1976d2; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const redIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="width: 16px; height: 16px; background: #d32f2f; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** 多点模式使用的小红点图标 */
const smallRedIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="width: 10px; height: 10px; background: #d32f2f; border: 1.5px solid white; border-radius: 50%; box-shadow: 0 0 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

/**
 * 根据地图类型获取对应的坐标系名称
 *
 * @param mapType 地图瓦片类型
 * @returns 坐标系名称字符串
 */
function getMapCoordinateLabel(mapType: MapType): string {
  switch (mapType) {
    case "tencent":
      return "腾讯地图 (GCJ-02)";
    case "baidu":
      return "百度地图 (BD-09)";
    case "osm":
      return "OpenStreetMap (WGS-84)";
    default:
      return "";
  }
}

/**
 * 根据地图类型获取对应的目标坐标系
 *
 * @param mapType 地图瓦片类型
 * @returns 坐标系枚举值
 */
function getMapCoordinateSystem(mapType: MapType): CoordinateSystem {
  switch (mapType) {
    case "tencent":
      return "GCJ02";
    case "baidu":
      return "BD09";
    case "osm":
      return "WGS84";
  }
}

/**
 * 将坐标转换到与当前瓦片匹配的坐标系
 * 当 targetSystem 未提供时，不做转换（向后兼容）
 *
 * @param lng 经度
 * @param lat 纬度
 * @param targetSystem 坐标原始所在坐标系
 * @param mapType 当前地图瓦片类型
 * @returns 转换后的 [经度, 纬度]
 */
function alignToTile(
  lng: number,
  lat: number,
  targetSystem: CoordinateSystem | undefined,
  mapType: MapType
): [number, number] {
  // 未提供原始坐标系时，不做转换（向后兼容）
  if (!targetSystem) {
    return [lng, lat];
  }

  const mapSystem: CoordinateSystem = getMapCoordinateSystem(mapType);

  // 已经是目标坐标系，无需转换
  if (targetSystem === mapSystem) {
    return [lng, lat];
  }

  return convert(lng, lat, targetSystem, mapSystem);
}

/**
 * 根据地图类型创建瓦片图层
 *
 * @param mapType 地图瓦片类型
 * @returns Leaflet瓦片图层
 */
function createTileLayer(mapType: MapType): L.TileLayer {
  switch (mapType) {
    case "tencent":
      // 腾讯地图瓦片，使用GCJ-02坐标系，TMS方式（y轴翻转）
      return L.tileLayer(
        "https://rt{s}.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}&type=vector&style=0",
        {
          subdomains: ["0", "1", "2", "3"],
          tms: true,
          attribution: "腾讯地图",
          maxZoom: 18,
        }
      );
    case "baidu":
      // 百度地图瓦片，使用BD-09坐标系
      // 使用 onlinelabel 接口（返回带标注的瓦片）
      // 不使用 tms: true，百度瓦片 Y 坐标由 BaiduTileLayer 自定义处理（y = -coords.y - 1）
      return createBaiduTileLayer(
        "https://online{s}.map.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&scaler=1",
        {
          subdomains: ["1", "2", "3"],
          attribution: "百度地图",
          maxZoom: 18,
        }
      );
    case "osm":
    default:
      // OpenStreetMap瓦片，使用WGS-84坐标系
      return L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }
      );
  }
}

/**
 * 地图预览组件
 * 支持单点模式（sourcePoint + targetPoint + 连线）和多点模式（points数组）
 * 支持OpenStreetMap、腾讯地图和百度地图瓦片切换
 * 支持坐标与瓦片对齐
 */
export default function MapPreview({
  sourcePoint = null,
  targetPoint = null,
  sourceLabel = "源坐标",
  targetLabel = "目标坐标",
  points,
  targetSystem,
  sourceSystem,
}: MapPreviewProps): JSX.Element {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sourceMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapType, setMapType] = useState<MapType>("tencent");
  /** 当前地图使用的 CRS，用于检测是否需要重建地图 */
  const currentCRSRef = useRef<L.CRS>(L.CRS.EPSG3857);

  /** 获取指定地图类型对应的 CRS */
  const getMapCRS = useCallback((type: MapType): L.CRS => {
    return type === "baidu" ? BaiduCRS : L.CRS.EPSG3857;
  }, []);

  /** 是否为多点模式 */
  const isBatchMode: boolean = !!points && points.length > 0;

  /** 创建弹出窗口内容，包含坐标和坐标系标注 */
  const buildPopupContent = useCallback(
    (label: string, lng: number, lat: number): string => {
      const mapSystemLabel: string = getMapCoordinateLabel(mapType);
      return `${label}<br/>经度: ${lng.toFixed(6)}<br/>纬度: ${lat.toFixed(6)}<br/><span style="color:#888;font-size:11px;">${mapSystemLabel}</span>`;
    },
    [mapType]
  );

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const crs: L.CRS = getMapCRS("tencent");
    currentCRSRef.current = crs;

    const map: L.Map = L.map(containerRef.current, {
      center: [39.9, 116.4],
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
      crs: crs,
    });

    // 根据默认地图类型添加瓦片层
    const tileLayer: L.TileLayer = createTileLayer("tencent");
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [getMapCRS]);

  // 切换地图类型时更换瓦片层（或重建地图以切换 CRS）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;

    const newCRS: L.CRS = getMapCRS(mapType);

    // 检测 CRS 是否发生变化（百度 <-> 其他）
    if (newCRS !== currentCRSRef.current) {
      // CRS 发生变化，需要销毁旧地图并创建新地图
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      sourceMarkerRef.current = null;
      targetMarkerRef.current = null;
      lineRef.current = null;

      if (markersGroupRef.current) {
        markersGroupRef.current = null;
      }

      currentCRSRef.current = newCRS;

      const newMap: L.Map = L.map(containerRef.current, {
        center: [39.9, 116.4],
        zoom: 10,
        zoomControl: true,
        attributionControl: true,
        crs: newCRS,
      });

      const tileLayer: L.TileLayer = createTileLayer(mapType);
      tileLayer.addTo(newMap);
      tileLayerRef.current = tileLayer;

      mapRef.current = newMap;
      return;
    }

    // CRS 未变，仅更换瓦片层
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }

    // 添加新瓦片层
    const tileLayer: L.TileLayer = createTileLayer(mapType);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // 确保瓦片层在标记下方
    tileLayer.bringToBack();

    // 刷新地图尺寸
    map.invalidateSize();
  }, [mapType, getMapCRS]);

  // 更新标记和视图（单点模式 + 多点模式 统一处理）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 清除旧标记
    if (sourceMarkerRef.current) {
      sourceMarkerRef.current.remove();
      sourceMarkerRef.current = null;
    }
    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }
    if (lineRef.current) {
      lineRef.current.remove();
      lineRef.current = null;
    }
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
      map.removeLayer(markersGroupRef.current);
      markersGroupRef.current = null;
    }

    const allPoints: L.LatLngExpression[] = [];

    if (isBatchMode && points) {
      // 多点模式：只显示转换后的坐标点
      const group = L.layerGroup().addTo(map);
      markersGroupRef.current = group;

      points.forEach((pt, index) => {
        const [alignedLng, alignedLat] = alignToTile(
          pt.lng,
          pt.lat,
          targetSystem,
          mapType
        );
        const latlng: L.LatLngExpression = [alignedLat, alignedLng];
        const label: string = pt.label || `点${index + 1}`;
        const marker = L.marker(latlng, { icon: smallRedIcon })
          .bindPopup(
            buildPopupContent(label, alignedLng, alignedLat)
          );
        group.addLayer(marker);
        allPoints.push(latlng);
      });
    } else {
      // 单点模式：显示源坐标(蓝) + 目标坐标(红) + 连线
      if (sourcePoint) {
        const [alignedLng, alignedLat] = alignToTile(
          sourcePoint.lng,
          sourcePoint.lat,
          sourceSystem,
          mapType
        );
        const latlng: L.LatLngExpression = [alignedLat, alignedLng];
        sourceMarkerRef.current = L.marker(latlng, { icon: blueIcon })
          .addTo(map)
          .bindPopup(
            buildPopupContent(sourceLabel, alignedLng, alignedLat)
          );
        allPoints.push(latlng);
      }

      if (targetPoint) {
        const [alignedLng, alignedLat] = alignToTile(
          targetPoint.lng,
          targetPoint.lat,
          targetSystem,
          mapType
        );
        const latlng: L.LatLngExpression = [alignedLat, alignedLng];
        targetMarkerRef.current = L.marker(latlng, { icon: redIcon })
          .addTo(map)
          .bindPopup(
            buildPopupContent(targetLabel, alignedLng, alignedLat)
          );
        allPoints.push(latlng);
      }

      if (sourcePoint && targetPoint) {
        const [srcAlignedLng, srcAlignedLat] = alignToTile(
          sourcePoint.lng,
          sourcePoint.lat,
          sourceSystem,
          mapType
        );
        const [tgtAlignedLng, tgtAlignedLat] = alignToTile(
          targetPoint.lng,
          targetPoint.lat,
          targetSystem,
          mapType
        );
        lineRef.current = L.polyline(
          [
            [srcAlignedLat, srcAlignedLng],
            [tgtAlignedLat, tgtAlignedLng],
          ],
          {
            color: "#9e9e9e",
            weight: 2,
            dashArray: "5, 5",
            opacity: 0.7,
          }
        ).addTo(map);
      }
    }

    // 自动调整视图
    if (allPoints.length === 1) {
      map.setView(allPoints[0], 12);
    } else if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [60, 60] });
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
    mapType,
    buildPopupContent,
  ]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 地图类型切换控件 */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
          px: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {getMapCoordinateLabel(mapType)}
        </Typography>
        <ToggleButtonGroup
          value={mapType}
          exclusive
          size="small"
          onChange={(_e, value: MapType | null) => {
            if (value !== null) {
              setMapType(value);
            }
          }}
        >
          <ToggleButton value="tencent" sx={{ py: 0, px: 1.5, fontSize: 12 }}>
            腾讯地图
          </ToggleButton>
          <ToggleButton value="baidu" sx={{ py: 0, px: 1.5, fontSize: 12 }}>
            百度地图
          </ToggleButton>
          <ToggleButton value="osm" sx={{ py: 0, px: 1.5, fontSize: 12 }}>
            OpenStreetMap
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 地图容器 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: "100%",
          minHeight: isBatchMode ? "400px" : "250px",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      />
    </Box>
  );
}
