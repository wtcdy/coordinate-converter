/**
 * 增量改进功能验证测试
 *
 * 测试内容:
 * 1. parseCoordinateLineOrdered — 支持经纬度顺序切换的行解析
 * 2. parseCoordinatesOrdered — 支持经纬度顺序切换的批量解析
 * 3. formatCoordinateOrdered — 支持经纬度顺序切换的格式化
 * 4. 向后兼容性 — 原有函数行为不变
 * 5. 边界情况 — 空输入、无效坐标、单数字、顺序切换
 * 6. 腾讯地图瓦片 — createTileLayer 和默认 mapType
 */

import { describe, it, expect } from "vitest";
import {
  parseCoordinateLine,
  parseCoordinates,
  formatCoordinate,
  parseCoordinateLineOrdered,
  parseCoordinatesOrdered,
  formatCoordinateOrdered,
  convert,
  isValidCoordinate,
} from "../src/utils/coordinateTransform";

// ============================================================
// 1. parseCoordinateLineOrdered — 经纬度顺序切换行解析
// ============================================================
describe("parseCoordinateLineOrdered", () => {
  describe("lngFirst = true (先经度后纬度)", () => {
    it("逗号分隔: '116.404, 39.915' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("116.404, 39.915", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("空格分隔: '116.404 39.915' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("116.404 39.915", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("中文逗号分隔: '116.404，39.915' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("116.404，39.915", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("Tab分隔: '116.404\\t39.915' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("116.404\t39.915", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("无空格逗号分隔: '116.404,39.915' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("116.404,39.915", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });
  });

  describe("lngFirst = false (先纬度后经度)", () => {
    it("逗号分隔: '116.404, 39.915' 应返回 {lng: 39.915, lat: 116.404}", () => {
      const result = parseCoordinateLineOrdered("116.404, 39.915", false);
      expect(result).toEqual({ lng: 39.915, lat: 116.404 });
    });

    it("空格分隔: '39.915 116.404' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("39.915 116.404", false);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("中文逗号分隔: '39.915，116.404' 应返回 {lng: 116.404, lat: 39.915}", () => {
      const result = parseCoordinateLineOrdered("39.915，116.404", false);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });
  });

  describe("边界情况", () => {
    it("空输入返回 null", () => {
      expect(parseCoordinateLineOrdered("", true)).toBeNull();
      expect(parseCoordinateLineOrdered("   ", true)).toBeNull();
      expect(parseCoordinateLineOrdered("", false)).toBeNull();
      expect(parseCoordinateLineOrdered("   ", false)).toBeNull();
    });

    it("单个数字输入返回 null", () => {
      expect(parseCoordinateLineOrdered("116.404", true)).toBeNull();
      expect(parseCoordinateLineOrdered("116.404", false)).toBeNull();
    });

    it("无效坐标（非数字）返回 null", () => {
      expect(parseCoordinateLineOrdered("abc, def", true)).toBeNull();
      expect(parseCoordinateLineOrdered("abc, def", false)).toBeNull();
    });

    it("负数坐标正确解析 (lngFirst=true)", () => {
      const result = parseCoordinateLineOrdered("-74.006, 40.7128", true);
      expect(result).toEqual({ lng: -74.006, lat: 40.7128 });
    });

    it("负数坐标正确解析 (lngFirst=false)", () => {
      const result = parseCoordinateLineOrdered("40.7128, -74.006", false);
      expect(result).toEqual({ lng: -74.006, lat: 40.7128 });
    });

    it("多余空格正确处理", () => {
      const result = parseCoordinateLineOrdered("  116.404 ,  39.915  ", true);
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("切换顺序后结果不同", () => {
      const result1 = parseCoordinateLineOrdered("116.404, 39.915", true);
      const result2 = parseCoordinateLineOrdered("116.404, 39.915", false);
      // lngFirst=true: {lng: 116.404, lat: 39.915}
      // lngFirst=false: {lng: 39.915, lat: 116.404}
      expect(result1?.lng).toBe(116.404);
      expect(result1?.lat).toBe(39.915);
      expect(result2?.lng).toBe(39.915);
      expect(result2?.lat).toBe(116.404);
    });
  });
});

// ============================================================
// 2. parseCoordinatesOrdered — 批量顺序解析
// ============================================================
describe("parseCoordinatesOrdered", () => {
  it("lngFirst=true: 多行正确解析", () => {
    const result = parseCoordinatesOrdered(
      "116.404, 39.915\n121.474, 31.230",
      true
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ lng: 116.404, lat: 39.915 });
    expect(result[1]).toEqual({ lng: 121.474, lat: 31.230 });
  });

  it("lngFirst=false: 多行正确解析，顺序反转", () => {
    const result = parseCoordinatesOrdered(
      "39.915, 116.404\n31.230, 121.474",
      false
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ lng: 116.404, lat: 39.915 });
    expect(result[1]).toEqual({ lng: 121.474, lat: 31.230 });
  });

  it("两种顺序解析相同的地理点应产生相同结果", () => {
    const result1 = parseCoordinatesOrdered(
      "116.404, 39.915\n121.474, 31.230",
      true
    );
    const result2 = parseCoordinatesOrdered(
      "39.915, 116.404\n31.230, 121.474",
      false
    );
    expect(result1).toEqual(result2);
  });

  it("空行应被跳过", () => {
    const result = parseCoordinatesOrdered(
      "116.404, 39.915\n\n121.474, 31.230",
      true
    );
    expect(result).toHaveLength(2);
  });

  it("无效行应被跳过", () => {
    const result = parseCoordinatesOrdered(
      "116.404, 39.915\ninvalid\n121.474, 31.230",
      true
    );
    expect(result).toHaveLength(2);
  });

  it("空文本返回空数组", () => {
    expect(parseCoordinatesOrdered("", true)).toHaveLength(0);
    expect(parseCoordinatesOrdered("", false)).toHaveLength(0);
    expect(parseCoordinatesOrdered("\n\n", true)).toHaveLength(0);
  });

  it("3行输入正确解析", () => {
    const result = parseCoordinatesOrdered(
      "116.404, 39.915\n121.474, 31.230\n113.264, 23.129",
      true
    );
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ lng: 113.264, lat: 23.129 });
  });
});

// ============================================================
// 3. formatCoordinateOrdered — 顺序格式化
// ============================================================
describe("formatCoordinateOrdered", () => {
  it("lngFirst=true: 格式化为 '116.404000, 39.915000'", () => {
    const result = formatCoordinateOrdered(116.404, 39.915, true);
    expect(result).toBe("116.404000, 39.915000");
  });

  it("lngFirst=false: 格式化为 '39.915000, 116.404000'", () => {
    const result = formatCoordinateOrdered(116.404, 39.915, false);
    expect(result).toBe("39.915000, 116.404000");
  });

  it("lngFirst=true: 指定4位小数", () => {
    const result = formatCoordinateOrdered(116.404123, 39.915456, true, 4);
    expect(result).toBe("116.4041, 39.9155");
  });

  it("lngFirst=false: 指定4位小数", () => {
    const result = formatCoordinateOrdered(116.404123, 39.915456, false, 4);
    expect(result).toBe("39.9155, 116.4041");
  });

  it("负数坐标正确格式化 (lngFirst=true)", () => {
    const result = formatCoordinateOrdered(-74.006, 40.7128, true);
    expect(result).toBe("-74.006000, 40.712800");
  });

  it("负数坐标正确格式化 (lngFirst=false)", () => {
    const result = formatCoordinateOrdered(-74.006, 40.7128, false);
    expect(result).toBe("40.712800, -74.006000");
  });

  it("与 formatCoordinate 的关系: lngFirst=true 时结果应一致", () => {
    const ordered = formatCoordinateOrdered(116.404, 39.915, true);
    const original = formatCoordinate(116.404, 39.915);
    expect(ordered).toBe(original);
  });
});

// ============================================================
// 4. 向后兼容性验证
// ============================================================
describe("向后兼容性", () => {
  describe("parseCoordinateLine 仍存在且行为不变", () => {
    it("逗号分隔解析不变", () => {
      expect(parseCoordinateLine("116.404,39.915")).toEqual({
        lng: 116.404,
        lat: 39.915,
      });
    });

    it("空格分隔解析不变", () => {
      expect(parseCoordinateLine("116.404 39.915")).toEqual({
        lng: 116.404,
        lat: 39.915,
      });
    });

    it("空行返回 null 不变", () => {
      expect(parseCoordinateLine("")).toBeNull();
    });

    it("单个数字返回 null 不变", () => {
      expect(parseCoordinateLine("116.404")).toBeNull();
    });

    it("非数字返回 null 不变", () => {
      expect(parseCoordinateLine("abc,def")).toBeNull();
    });
  });

  describe("parseCoordinates 仍存在且行为不变", () => {
    it("多行解析不变", () => {
      const result = parseCoordinates("116.404, 39.915\n121.474, 31.230");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ lng: 116.404, lat: 39.915 });
      expect(result[1]).toEqual({ lng: 121.474, lat: 31.230 });
    });

    it("空行跳过不变", () => {
      const result = parseCoordinates("116.404, 39.915\n\n121.474, 31.230");
      expect(result).toHaveLength(2);
    });

    it("空文本返回空数组不变", () => {
      expect(parseCoordinates("")).toHaveLength(0);
    });
  });

  describe("formatCoordinate 仍存在且行为不变", () => {
    it("默认6位小数不变", () => {
      expect(formatCoordinate(116.404123, 39.915456)).toBe(
        "116.404123, 39.915456"
      );
    });

    it("指定4位小数不变", () => {
      expect(formatCoordinate(116.404123, 39.915456, 4)).toBe(
        "116.4041, 39.9155"
      );
    });
  });
});

// ============================================================
// 5. 顺序切换与转换集成测试
// ============================================================
describe("顺序切换与转换集成", () => {
  it("lngFirst=true 解析后转换应得到正确结果", () => {
    const parsed = parseCoordinateLineOrdered("116.404, 39.915", true);
    expect(parsed).not.toBeNull();
    const [targetLng, targetLat] = convert(
      parsed!.lng,
      parsed!.lat,
      "WGS84",
      "GCJ02"
    );
    // 北京 WGS84->GCJ02 应有偏移
    expect(targetLng).not.toBe(116.404);
    expect(targetLat).not.toBe(39.915);
    // 格式化输出
    const formatted = formatCoordinateOrdered(targetLng, targetLat, true);
    expect(formatted).toContain(",");
  });

  it("lngFirst=false 解析后转换应得到相同转换结果", () => {
    const parsed1 = parseCoordinateLineOrdered("116.404, 39.915", true);
    const parsed2 = parseCoordinateLineOrdered("39.915, 116.404", false);
    expect(parsed1).toEqual(parsed2);

    const [r1lng, r1lat] = convert(
      parsed1!.lng,
      parsed1!.lat,
      "WGS84",
      "GCJ02"
    );
    const [r2lng, r2lat] = convert(
      parsed2!.lng,
      parsed2!.lat,
      "WGS84",
      "GCJ02"
    );
    expect(r1lng).toBe(r2lng);
    expect(r1lat).toBe(r2lat);
  });

  it("批量解析+转换 lngFirst=true 与 lngFirst=false 等价", () => {
    const coords1 = parseCoordinatesOrdered(
      "116.404, 39.915\n121.474, 31.230",
      true
    );
    const coords2 = parseCoordinatesOrdered(
      "39.915, 116.404\n31.230, 121.474",
      false
    );

    coords1.forEach((c1, i) => {
      const c2 = coords2[i];
      const [t1lng, t1lat] = convert(c1.lng, c1.lat, "WGS84", "GCJ02");
      const [t2lng, t2lat] = convert(c2.lng, c2.lat, "WGS84", "GCJ02");
      expect(t1lng).toBe(t2lng);
      expect(t1lat).toBe(t2lat);
    });
  });
});

// ============================================================
// 6. 腾讯地图瓦片相关验证
// ============================================================
describe("腾讯地图瓦片", () => {
  it("createTileLayer 函数应存在于 MapPreview.tsx 中", () => {
    // 验证源码中包含 createTileLayer 函数定义
    // 这里通过读取源文件确认
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("function createTileLayer");
    expect(source).toContain("mapType: MapType");
  });

  it("默认 mapType 应为 'tencent'", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    // 检查 useState 默认值
    expect(source).toContain('useState<MapType>("tencent")');
  });

  it("腾讯地图瓦片URL应正确", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain(
      "https://rt{s}.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}&type=vector&style=0"
    );
  });

  it("MapPreviewProps 接口未被破坏", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    // 检查原有props仍存在
    // sourcePoint 和 targetPoint 已变为可选属性（加了 ?）
    expect(source).toContain("sourcePoint?: LngLat | null");
    expect(source).toContain("targetPoint?: LngLat | null");
    expect(source).toContain("sourceLabel");
    expect(source).toContain("targetLabel");
  });

  it("ToggleButtonGroup 切换控件应存在", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("ToggleButtonGroup");
    expect(source).toContain('"tencent"');
    expect(source).toContain('"osm"');
  });

  it("createTileLayer 支持 tencent、baidu 和 osm 三种类型", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/MapPreview.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    // tencent 类型分支（switch-case）
    expect(source).toMatch(/case\s+["']tencent["']/);
    // baidu 类型分支
    expect(source).toMatch(/case\s+["']baidu["']/);
    // osm 回退分支
    expect(source).toContain("openstreetmap.org");
  });
});

// ============================================================
// 7. SinglePointConverter 组件验证
// ============================================================
describe("SinglePointConverter 合并输入框", () => {
  it("应使用 coordStr 单一 state 替代 lngStr + latStr", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("coordStr");
    expect(source).not.toContain("lngStr");
    expect(source).not.toContain("latStr");
  });

  it("应使用 parseCoordinateLineOrdered 函数解析输入", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("parseCoordinateLineOrdered");
  });

  it("应使用 formatCoordinateOrdered 函数格式化复制内容", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("formatCoordinateOrdered");
  });

  it("应有 lngFirst state 和 SwapVertIcon 切换按钮", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("lngFirst");
    expect(source).toContain("SwapVertIcon");
  });

  it("输入框 label 应根据 lngFirst 动态显示", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/SinglePointConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toMatch(/lngFirst.*经度.*纬度|经度.*纬度.*lngFirst/);
  });
});

// ============================================================
// 8. BatchConverter 组件验证
// ============================================================
describe("BatchConverter 顺序切换", () => {
  it("应使用 parseCoordinatesOrdered 函数", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("parseCoordinatesOrdered");
  });

  it("应有 lngFirst state 和 SwapVertIcon 切换按钮", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toContain("lngFirst");
    expect(source).toContain("SwapVertIcon");
  });

  it("复制结果时应根据 lngFirst 调整顺序", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    // 验证 handleCopyAll 中使用了 lngFirst 判断
    expect(source).toMatch(
      /lngFirst[\s\S]*targetLng[\s\S]*targetLat|targetLat[\s\S]*targetLng[\s\S]*lngFirst/
    );
  });

  it("CSV导出时应根据 lngFirst 调整列顺序", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.join(
      __dirname,
      "../src/components/BatchConverter.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");
    // 验证 handleExportCSV 中使用了 lngFirst 判断
    expect(source).toMatch(/handleExportCSV[\s\S]*lngFirst/);
  });
});
