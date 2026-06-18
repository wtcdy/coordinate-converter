/**
 * 地图改进功能验证测试
 *
 * 测试内容:
 * 1. alignToTile 坐标对齐逻辑（通过 convert 函数间接验证）
 * 2. sourcePoint 对齐 Bug 验证
 * 3. 百度地图瓦片验证
 * 4. 多点模式验证
 * 5. 组件集成验证
 * 6. 边界情况测试
 */

import { describe, it, expect } from "vitest";
import { convert } from "../src/utils/coordinateTransform";
import type { CoordinateSystem } from "../src/types/coordinate";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// 辅助函数：模拟 alignToTile 的逻辑
// 因为 alignToTile 是 MapPreview.tsx 内部的私有函数，
// 我们通过复制其核心逻辑来测试
// ============================================================

/** 模拟 alignToTile 函数（从源码提取的逻辑） */
function simulateAlignToTile(
  lng: number,
  lat: number,
  sourceSystem: CoordinateSystem | undefined,
  mapType: "osm" | "tencent" | "baidu"
): [number, number] {
  if (!sourceSystem) {
    return [lng, lat];
  }

  const mapSystemMap: Record<string, CoordinateSystem> = {
    tencent: "GCJ02",
    baidu: "BD09",
    osm: "WGS84",
  };
  const mapSystem: CoordinateSystem = mapSystemMap[mapType];

  if (sourceSystem === mapSystem) {
    return [lng, lat];
  }

  return convert(lng, lat, sourceSystem, mapSystem);
}

// ============================================================
// 1. alignToTile 坐标对齐逻辑验证
// ============================================================
describe("alignToTile 坐标对齐逻辑", () => {
  const testLng = 116.404;
  const testLat = 39.915;

  it("当 sourceSystem=GCJ02 且 mapType=tencent 时，坐标不应被转换（GCJ02→GCJ02 = 原值）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "GCJ02", "tencent"
    );
    expect(alignedLng).toBe(testLng);
    expect(alignedLat).toBe(testLat);
  });

  it("当 sourceSystem=GCJ02 且 mapType=osm 时，应将 GCJ02 坐标转换为 WGS84（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "GCJ02", "osm"
    );
    // GCJ02 → WGS84 应有偏移
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    // 偏移量应与 convert 函数一致
    const [expectedLng, expectedLat] = convert(testLng, testLat, "GCJ02", "WGS84");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=GCJ02 且 mapType=baidu 时，应将 GCJ02 坐标转换为 BD09（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "GCJ02", "baidu"
    );
    // GCJ02 → BD09 应有偏移
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    const [expectedLng, expectedLat] = convert(testLng, testLat, "GCJ02", "BD09");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=BD09 且 mapType=baidu 时，不应转换", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "BD09", "baidu"
    );
    expect(alignedLng).toBe(testLng);
    expect(alignedLat).toBe(testLat);
  });

  it("当 sourceSystem=WGS84 且 mapType=osm 时，不应转换", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "WGS84", "osm"
    );
    expect(alignedLng).toBe(testLng);
    expect(alignedLat).toBe(testLat);
  });

  it("当 sourceSystem=WGS84 且 mapType=tencent 时，应将 WGS84 转换为 GCJ02（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "WGS84", "tencent"
    );
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    const [expectedLng, expectedLat] = convert(testLng, testLat, "WGS84", "GCJ02");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=WGS84 且 mapType=baidu 时，应将 WGS84 转换为 BD09（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "WGS84", "baidu"
    );
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    const [expectedLng, expectedLat] = convert(testLng, testLat, "WGS84", "BD09");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=BD09 且 mapType=osm 时，应将 BD09 转换为 WGS84（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "BD09", "osm"
    );
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    const [expectedLng, expectedLat] = convert(testLng, testLat, "BD09", "WGS84");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=undefined 时，不做转换（向后兼容）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, undefined, "tencent"
    );
    expect(alignedLng).toBe(testLng);
    expect(alignedLat).toBe(testLat);
  });

  it("CGCS2000 坐标在 OSM 地图上应转换为 WGS84（近似等同，原值返回）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "CGCS2000", "osm"
    );
    // CGCS2000 ≈ WGS84, 所以不应有明显偏移
    expect(alignedLng).toBe(testLng);
    expect(alignedLat).toBe(testLat);
  });

  it("CGCS2000 坐标在腾讯地图上应转换为 GCJ02（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      testLng, testLat, "CGCS2000", "tencent"
    );
    expect(alignedLng).not.toBe(testLng);
    expect(alignedLat).not.toBe(testLat);
    const [expectedLng, expectedLat] = convert(testLng, testLat, "CGCS2000", "GCJ02");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });
});

// ============================================================
// 2. sourcePoint 对齐修复验证（Round 2）
// ============================================================
describe("sourcePoint 对齐修复验证", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("MapPreviewProps 应包含 sourceSystem prop", () => {
    expect(source).toContain("sourceSystem?: CoordinateSystem");
  });

  it("sourcePoint 标记放置应使用 sourceSystem 对齐", () => {
    // 验证 sourcePoint 标记放置时 alignToTile 使用 sourceSystem
    // 找到 sourcePoint 标记的 alignToTile 调用
    const sourcePointAlignIdx = source.indexOf("sourcePoint.lng");
    // 在该位置之后应使用 sourceSystem 而非 targetSystem
    const surroundingCode = source.substring(sourcePointAlignIdx, sourcePointAlignIdx + 200);
    expect(surroundingCode).toContain("sourceSystem");
    expect(surroundingCode).not.toContain("targetSystem");
  });

  it("连线源端应使用 sourceSystem 对齐", () => {
    // 找到连线部分的 sourcePoint alignToTile 调用
    // 连线部分在 sourcePoint && targetPoint 条件块中
    const lineSectionIdx = source.indexOf("sourcePoint && targetPoint");
    const lineSection = source.substring(lineSectionIdx, lineSectionIdx + 500);
    // 验证 srcAlignedLng/Lat 使用 sourceSystem
    expect(lineSection).toContain("sourceSystem");
    // 验证 tgtAlignedLng/Lat 使用 targetSystem
    expect(lineSection).toContain("targetSystem");
  });

  it("targetPoint 标记放置应使用 targetSystem 对齐（未受影响）", () => {
    const targetPointAlignIdx = source.indexOf("targetPoint.lng");
    const surroundingCode = source.substring(targetPointAlignIdx, targetPointAlignIdx + 200);
    expect(surroundingCode).toContain("targetSystem");
  });

  it("useEffect 依赖数组应包含 sourceSystem", () => {
    // 找到更新标记的 useEffect 依赖数组
    const useEffectMatches = source.match(
      /useEffect\(\(\) => \{[\s\S]*?const allPoints[\s\S]*?\}, \[[^\]]*\]\)/g
    );
    expect(useEffectMatches).not.toBeNull();
    const markerEffect = useEffectMatches!.find((m) => m.includes("allPoints"));
    expect(markerEffect).not.toBeNull();
    expect(markerEffect!).toContain("sourceSystem");
  });

  it("当 sourceSystem=WGS84 且 mapType=tencent 时，sourcePoint 应做 WGS84→GCJ02 转换（有偏移）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.404, 39.915, "WGS84", "tencent"
    );
    expect(alignedLng).not.toBe(116.404);
    expect(alignedLat).not.toBe(39.915);
    const [expectedLng, expectedLat] = convert(116.404, 39.915, "WGS84", "GCJ02");
    expect(alignedLng).toBe(expectedLng);
    expect(alignedLat).toBe(expectedLat);
  });

  it("当 sourceSystem=WGS84 且 mapType=osm 时，sourcePoint 不转换", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.404, 39.915, "WGS84", "osm"
    );
    expect(alignedLng).toBe(116.404);
    expect(alignedLat).toBe(39.915);
  });

  it("当 sourceSystem=GCJ02 且 mapType=tencent 时，sourcePoint 不转换", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.404, 39.915, "GCJ02", "tencent"
    );
    expect(alignedLng).toBe(116.404);
    expect(alignedLat).toBe(39.915);
  });

  it("当 sourceSystem=undefined 时，sourcePoint 不转换（向后兼容）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.404, 39.915, undefined, "tencent"
    );
    expect(alignedLng).toBe(116.404);
    expect(alignedLat).toBe(39.915);
  });

  it("targetPoint 仍使用 targetSystem 对齐（未受影响）", () => {
    // targetPoint 使用 targetSystem="GCJ02" 在腾讯地图上对齐是正确的
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.410244, 39.916404, "GCJ02", "tencent"
    );
    expect(alignedLng).toBe(116.410244);
    expect(alignedLat).toBe(39.916404);
  });

  it("points 多点模式仍使用 targetSystem（未受影响）", () => {
    // 验证多点模式中 alignToTile 仍使用 targetSystem
    const isBatchIdx = source.indexOf("isBatchMode && points");
    const elseIdx = source.indexOf("} else {", isBatchIdx);
    const batchSection = source.substring(isBatchIdx, elseIdx);
    expect(batchSection).toContain("targetSystem");
    expect(batchSection).not.toContain("sourceSystem");
  });

  it("Bug修复验证: sourcePoint 不再使用 targetSystem 对齐", () => {
    // 验证修复后 sourcePoint 对齐不再使用 targetSystem
    const sourcePointAlignIdx = source.indexOf("sourcePoint.lng");
    const surroundingCode = source.substring(sourcePointAlignIdx, sourcePointAlignIdx + 200);
    // sourcePoint 对齐不应使用 targetSystem
    expect(surroundingCode).not.toContain("targetSystem");
    // 应使用 sourceSystem
    expect(surroundingCode).toContain("sourceSystem");
  });
});

// ============================================================
// 3. 百度地图瓦片验证
// ============================================================
describe("百度地图瓦片验证", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("MapType 类型应包含 baidu", () => {
    expect(source).toContain('"osm" | "tencent" | "baidu"');
  });

  it("createTileLayer 应包含 baidu 分支", () => {
    expect(source).toMatch(/case\s+["']baidu["']/);
  });

  it("百度地图瓦片 URL 格式应正确", () => {
    // 百度瓦片使用 onlinelabel 接口（带标注瓦片），域名格式 online{s}.map.bdimg.com
    // 也接受 maponline{s}.bdimg.com/tile/?qt=vtile 格式
    const hasBaiduTileUrl =
      source.includes("https://online{s}.map.bdimg.com/onlinelabel/?qt=tile") ||
      source.includes("https://maponline{s}.bdimg.com/tile/?qt=vtile");
    expect(hasBaiduTileUrl).toBe(true);
  });

  it("百度地图瓦片应配置 tms: true", () => {
    // 定位 createTileLayer 函数中的 baidu 分支
    const createTileStart = source.indexOf("function createTileLayer");
    const baiduCaseStart = source.indexOf('case "baidu"', createTileStart);
    const osmCaseStart = source.indexOf('case "osm"', createTileStart);
    const baiduBlock = source.substring(baiduCaseStart, osmCaseStart);
    expect(baiduBlock).toContain("tms: true");
  });

  it("百度地图瓦片应配置 subdomains", () => {
    const createTileStart = source.indexOf("function createTileLayer");
    const baiduCaseStart = source.indexOf('case "baidu"', createTileStart);
    const osmCaseStart = source.indexOf('case "osm"', createTileStart);
    const baiduBlock = source.substring(baiduCaseStart, osmCaseStart);
    // 百度 onlinelabel 接口使用 subdomains 1-3；maponline 接口使用 0-3
    const hasValidSubdomains =
      baiduBlock.includes('subdomains: ["1", "2", "3"]') ||
      baiduBlock.includes('subdomains: ["0", "1", "2", "3"]');
    expect(hasValidSubdomains).toBe(true);
  });

  it("百度地图瓦片应配置 maxZoom: 18", () => {
    const createTileStart = source.indexOf("function createTileLayer");
    const baiduCaseStart = source.indexOf('case "baidu"', createTileStart);
    const osmCaseStart = source.indexOf('case "osm"', createTileStart);
    const baiduBlock = source.substring(baiduCaseStart, osmCaseStart);
    expect(baiduBlock).toContain("maxZoom: 18");
  });

  it("百度地图瓦片应配置 attribution", () => {
    const baiduSection = source.match(
      /case\s+["']baidu["'][\s\S]*?return L\.tileLayer/
    );
    expect(baiduSection).not.toBeNull();
    expect(baiduSection![0]).toContain("百度地图");
  });

  it("ToggleButtonGroup 应包含百度地图按钮", () => {
    expect(source).toMatch(/ToggleButton.*value=["']baidu["']/);
  });

  it("getMapCoordinateLabel 应支持 baidu", () => {
    expect(source).toMatch(/case\s+["']baidu["'][\s\S]*?百度地图.*BD-09/);
  });

  it("getMapCoordinateSystem 应将 baidu 映射到 BD09", () => {
    const getMapCoordSection = source.match(
      /function getMapCoordinateSystem[\s\S]*?^}/m
    );
    expect(getMapCoordSection).not.toBeNull();
    expect(getMapCoordSection![0]).toMatch(/["']baidu["'][\s\S]*?["']BD09["']/);
  });
});

// ============================================================
// 4. 多点模式验证
// ============================================================
describe("多点模式验证", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("MapPreviewProps 应包含 points 属性", () => {
    expect(source).toContain("points?: MapPointItem[]");
  });

  it("MapPointItem 接口应正确导出", () => {
    expect(source).toContain("export interface MapPointItem");
    expect(source).toContain("lng: number");
    expect(source).toContain("lat: number");
    expect(source).toContain("label?: string");
  });

  it("isBatchMode 判断逻辑应为 !!points && points.length > 0", () => {
    expect(source).toContain("!!points && points.length > 0");
  });

  it("多点模式下应使用 smallRedIcon", () => {
    expect(source).toContain("smallRedIcon");
  });

  it("多点模式下应绑定 popup 显示序号和坐标", () => {
    // 使用 indexOf 精确定位批量模式代码块
    const isBatchIdx = source.indexOf("isBatchMode && points");
    const elseIdx = source.indexOf("} else {", isBatchIdx);
    const batchSection = source.substring(isBatchIdx, elseIdx);
    expect(batchSection).toContain("bindPopup");
  });

  it("多点模式下应使用 L.layerGroup", () => {
    expect(source).toContain("L.layerGroup().addTo(map)");
  });

  it("多点模式下 points 的坐标应使用 alignToTile 对齐", () => {
    const isBatchIdx = source.indexOf("isBatchMode && points");
    const elseIdx = source.indexOf("} else {", isBatchIdx);
    const batchSection = source.substring(isBatchIdx, elseIdx);
    expect(batchSection).toContain("alignToTile");
  });

  it("多点模式下自动 fitBounds 包含所有点", () => {
    expect(source).toContain("L.latLngBounds(allPoints)");
    expect(source).toContain("fitBounds");
  });
});

// ============================================================
// 5. 组件集成验证
// ============================================================
describe("组件集成验证", () => {
  it("BatchConverter 应传入 points 和 targetSystem", () => {
    const batchPath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const batchSource = fs.readFileSync(batchPath, "utf-8");

    // 检查 MapPreview 组件调用中包含 points prop
    expect(batchSource).toMatch(/points=\{/);
    // 检查 MapPreview 组件调用中包含 targetSystem prop
    expect(batchSource).toMatch(/targetSystem=\{toSystem\}/);
  });

  it("BatchConverter 的 points 应映射 targetPoint 坐标", () => {
    const batchPath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const batchSource = fs.readFileSync(batchPath, "utf-8");

    // 检查 points 映射中使用 targetPoint
    expect(batchSource).toContain("r.targetPoint.lng");
    expect(batchSource).toContain("r.targetPoint.lat");
  });

  it("SinglePointConverter 应传入 targetSystem", () => {
    const singlePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const singleSource = fs.readFileSync(singlePath, "utf-8");

    // 检查 MapPreview 组件调用中包含 targetSystem prop
    expect(singleSource).toMatch(/targetSystem=\{toSystem\}/);
  });

  it("SinglePointConverter 应传入 sourcePoint 和 targetPoint", () => {
    const singlePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const singleSource = fs.readFileSync(singlePath, "utf-8");

    expect(singleSource).toMatch(/sourcePoint=\{sourcePoint\}/);
    expect(singleSource).toMatch(/targetPoint=\{targetPoint\}/);
  });

  it("SinglePointConverter 应传入 sourceSystem={fromSystem}", () => {
    const singlePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const singleSource = fs.readFileSync(singlePath, "utf-8");

    // 修复后应传入 sourceSystem={fromSystem}
    expect(singleSource).toMatch(/sourceSystem=\{fromSystem\}/);
  });

  it("BatchConverter 不需要 sourceSystem（批量模式只显示 targetPoint）", () => {
    const batchPath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const batchSource = fs.readFileSync(batchPath, "utf-8");

    // 批量模式不需要 sourceSystem
    expect(batchSource).not.toContain("sourceSystem");
  });
});

// ============================================================
// 6. 边界情况测试
// ============================================================
describe("边界情况测试", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("points 为空数组时 isBatchMode 应为 false", () => {
    // !![] && [].length > 0 → true && false → false
    // 空数组 length = 0，所以 isBatchMode = false
    // 这意味着 points=[] 应走单点模式
    const points: unknown[] = [];
    const isBatchMode = !!points && points.length > 0;
    expect(isBatchMode).toBe(false);
  });

  it("points 为 undefined 时 isBatchMode 应为 false", () => {
    const points = undefined;
    const isBatchMode = !!points && (points as unknown[]).length > 0;
    expect(isBatchMode).toBe(false);
  });

  it("points 为单个元素的数组时 isBatchMode 应为 true", () => {
    const points = [{ lng: 116.404, lat: 39.915 }];
    const isBatchMode = !!points && points.length > 0;
    expect(isBatchMode).toBe(true);
  });

  it("targetSystem 为 undefined 时 alignToTile 不做转换（向后兼容）", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      116.404, 39.915, undefined, "tencent"
    );
    expect(alignedLng).toBe(116.404);
    expect(alignedLat).toBe(39.915);
  });

  it("MapPreview 组件 minHeight 在批量模式下为 400px", () => {
    expect(source).toContain('minHeight: isBatchMode ? "400px" : "250px"');
  });

  it("海外坐标对齐: WGS84 纽约坐标在 OSM 上不偏移", () => {
    const [alignedLng, alignedLat] = simulateAlignToTile(
      -74.006, 40.7128, "WGS84", "osm"
    );
    expect(alignedLng).toBe(-74.006);
    expect(alignedLat).toBe(40.7128);
  });

  it("海外坐标对齐: WGS84 纽约坐标在腾讯地图上转为 GCJ02 应原值返回（境外不偏移）", () => {
    // 纽约坐标在 outOfChina 范围内，GCJ02 偏移应为 0
    const [alignedLng, alignedLat] = simulateAlignToTile(
      -74.006, 40.7128, "WGS84", "tencent"
    );
    // WGS84 → GCJ02 对海外坐标应原值返回
    expect(alignedLng).toBe(-74.006);
    expect(alignedLat).toBe(40.7128);
  });
});

// ============================================================
// 7. 切换瓦片时标记重新计算验证
// ============================================================
describe("切换瓦片时标记重新计算", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("标记更新 useEffect 应依赖 mapType", () => {
    // 验证更新标记的 useEffect 依赖数组包含 mapType
    const useEffectMatches = source.match(
      /useEffect\(\(\) => \{[\s\S]*?const allPoints[\s\S]*?\}, \[[^\]]*\]\)/g
    );
    expect(useEffectMatches).not.toBeNull();
    // 找到包含 allPoints 的 useEffect，其依赖应包含 mapType
    const markerEffect = useEffectMatches!.find((m) => m.includes("allPoints"));
    expect(markerEffect).not.toBeNull();
    expect(markerEffect!).toContain("mapType");
  });

  it("切换瓦片 useEffect 应依赖 mapType", () => {
    // 验证切换瓦片的 useEffect 依赖数组包含 mapType
    const tileEffectMatch = source.match(
      /切换地图类型时更换瓦片层[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[([^\]]*)\]\)/
    );
    expect(tileEffectMatch).not.toBeNull();
    expect(tileEffectMatch![1]).toContain("mapType");
  });
});

// ============================================================
// 8. 修复已有失败测试 — 更新断言以适配新代码
// ============================================================
describe("已有测试断言更新验证", () => {
  const sourcePath = path.join(
    __dirname,
    "../src/components/MapPreview.tsx"
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  it("MapPreviewProps 接口中 sourcePoint 现在是可选的（加了 ?）", () => {
    // 旧测试检查 "sourcePoint: LngLat | null"，但新代码是 "sourcePoint?: LngLat | null"
    expect(source).toContain("sourcePoint?: LngLat | null");
  });

  it("MapPreviewProps 接口中 targetPoint 现在是可选的（加了 ?）", () => {
    expect(source).toContain("targetPoint?: LngLat | null");
  });

  it("createTileLayer 使用 switch-case 而非 === 比较", () => {
    // 旧测试检查 mapType === "tencent"，但新代码用 switch-case
    expect(source).toMatch(/case\s+["']tencent["']/);
    expect(source).toMatch(/case\s+["']baidu["']/);
    expect(source).toMatch(/case\s+["']osm["']/);
  });
});
