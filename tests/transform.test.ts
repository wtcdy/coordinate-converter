/**
 * 坐标系转换算法正确性验证测试
 *
 * 测试内容:
 * 1. WGS84 -> GCJ02 偏移正确性
 * 2. GCJ02 -> WGS84 逆转换精度
 * 3. GCJ02 -> BD09 偏移正确性
 * 4. BD09 -> GCJ02 逆转换精度
 * 5. 海外坐标不偏移
 * 6. WGS84 <-> CGCS2000 原值返回
 * 7. CGCS2000 -> GCJ02 与 WGS84->GCJ02 一致
 * 8. 全链路往返精度
 * 9. 工具函数测试
 * 10. 边界情况测试
 */

import { describe, it, expect } from "vitest";
import {
  wgs84togcj02,
  gcj02towgs84,
  gcj02tobd09,
  bd09togcj02,
  wgs84tocgcs2000,
  cgcs2000towgs84,
  cgcs2000togcj02,
  wgs84tobd09,
  bd09towgs84,
  convert,
  roundCoordinate,
  parseCoordinateLine,
  parseCoordinates,
  isValidCoordinate,
  formatCoordinate,
} from "../src/utils/coordinateTransform";

// ============================================================
// 辅助函数
// ============================================================

/** 比较两个坐标是否在容差范围内 */
function approxEqual(
  actual: number,
  expected: number,
  tolerance: number
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/** 比较两个坐标对是否在容差范围内 */
function coordApproxEqual(
  actual: [number, number],
  expected: [number, number],
  tolerance: number
): boolean {
  return (
    approxEqual(actual[0], expected[0], tolerance) &&
    approxEqual(actual[1], expected[1], tolerance)
  );
}

// ============================================================
// 1. WGS84 -> GCJ02 偏移正确性
// ============================================================
describe("WGS84 -> GCJ02", () => {
  it("北京坐标应产生约 +0.006 经度, +0.0014 纬度偏移", () => {
    const wgs84_lng = 116.404;
    const wgs84_lat = 39.915;
    const [gcj_lng, gcj_lat] = wgs84togcj02(wgs84_lng, wgs84_lat);

    const dLng = gcj_lng - wgs84_lng;
    const dLat = gcj_lat - wgs84_lat;

    // 经度偏移约 0.005~0.007
    expect(dLng).toBeGreaterThan(0.004);
    expect(dLng).toBeLessThan(0.008);

    // 纬度偏移约 0.001~0.003
    expect(dLat).toBeGreaterThan(0.0005);
    expect(dLat).toBeLessThan(0.004);
  });

  it("上海坐标应产生偏移", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(121.474, 31.230);
    // 偏移应存在（不等于原值），方向不固定
    const dLng = Math.abs(gcj_lng - 121.474);
    const dLat = Math.abs(gcj_lat - 31.230);
    expect(dLng).toBeGreaterThan(0.001);
    expect(dLat).toBeGreaterThan(0.0005);
  });

  it("广州坐标应产生偏移", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(113.264, 23.129);
    // 偏移应存在（不等于原值），方向不固定
    const dLng = Math.abs(gcj_lng - 113.264);
    const dLat = Math.abs(gcj_lat - 23.129);
    expect(dLng).toBeGreaterThan(0.001);
    expect(dLat).toBeGreaterThan(0.0005);
  });
});

// ============================================================
// 2. GCJ02 -> WGS84 逆转换精度
// ============================================================
describe("GCJ02 -> WGS84 逆转换", () => {
  it("与 WGS84->GCJ02 互逆, 误差应 < 0.0001 度", () => {
    const wgs84_lng = 116.404;
    const wgs84_lat = 39.915;

    const [gcj_lng, gcj_lat] = wgs84togcj02(wgs84_lng, wgs84_lat);
    const [recovered_lng, recovered_lat] = gcj02towgs84(gcj_lng, gcj_lat);

    expect(
      approxEqual(recovered_lng, wgs84_lng, 0.0001),
      `经度恢复误差: 实际=${recovered_lng}, 期望=${wgs84_lng}, 差值=${Math.abs(recovered_lng - wgs84_lng)}`
    ).toBe(true);
    expect(
      approxEqual(recovered_lat, wgs84_lat, 0.0001),
      `纬度恢复误差: 实际=${recovered_lat}, 期望=${wgs84_lat}, 差值=${Math.abs(recovered_lat - wgs84_lat)}`
    ).toBe(true);
  });

  it("上海坐标互逆误差应 < 0.0001 度", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(121.474, 31.230);
    const [recovered_lng, recovered_lat] = gcj02towgs84(gcj_lng, gcj_lat);

    expect(approxEqual(recovered_lng, 121.474, 0.0001)).toBe(true);
    expect(approxEqual(recovered_lat, 31.230, 0.0001)).toBe(true);
  });
});

// ============================================================
// 3. GCJ02 -> BD09 偏移正确性
// ============================================================
describe("GCJ02 -> BD09", () => {
  it("(116.410244, 39.916404) 应产生约 +0.006 经度, +0.006 纬度偏移", () => {
    const gcj_lng = 116.410244;
    const gcj_lat = 39.916404;
    const [bd_lng, bd_lat] = gcj02tobd09(gcj_lng, gcj_lat);

    const dLng = bd_lng - gcj_lng;
    const dLat = bd_lat - gcj_lat;

    // 经度偏移约 0.004~0.008
    expect(dLng).toBeGreaterThan(0.003);
    expect(dLng).toBeLessThan(0.009);

    // 纬度偏移约 0.004~0.008
    expect(dLat).toBeGreaterThan(0.003);
    expect(dLat).toBeLessThan(0.009);
  });
});

// ============================================================
// 4. BD09 -> GCJ02 逆转换精度
// ============================================================
describe("BD09 -> GCJ02 逆转换", () => {
  it("与 GCJ02->BD09 互逆, 误差应 < 0.001 度", () => {
    const gcj_lng = 116.410244;
    const gcj_lat = 39.916404;

    const [bd_lng, bd_lat] = gcj02tobd09(gcj_lng, gcj_lat);
    const [recovered_lng, recovered_lat] = bd09togcj02(bd_lng, bd_lat);

    expect(
      approxEqual(recovered_lng, gcj_lng, 0.001),
      `经度恢复误差: 实际=${recovered_lng}, 期望=${gcj_lng}, 差值=${Math.abs(recovered_lng - gcj_lng)}`
    ).toBe(true);
    expect(
      approxEqual(recovered_lat, gcj_lat, 0.001),
      `纬度恢复误差: 实际=${recovered_lat}, 期望=${gcj_lat}, 差值=${Math.abs(recovered_lat - gcj_lat)}`
    ).toBe(true);
  });
});

// ============================================================
// 5. 海外坐标不偏移
// ============================================================
describe("海外坐标不偏移", () => {
  it("纽约坐标 WGS84->GCJ02 应原值返回", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(-74.006, 40.7128);
    expect(gcj_lng).toBe(-74.006);
    expect(gcj_lat).toBe(40.7128);
  });

  it("伦敦坐标 WGS84->GCJ02 应原值返回", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(-0.1278, 51.5074);
    expect(gcj_lng).toBe(-0.1278);
    expect(gcj_lat).toBe(51.5074);
  });

  it("东京坐标 WGS84->GCJ02 应原值返回（日本在 outOfChina 范围外）", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(139.6917, 35.6895);
    expect(gcj_lng).toBe(139.6917);
    expect(gcj_lat).toBe(35.6895);
  });

  it("海外坐标 GCJ02->WGS84 也应原值返回", () => {
    const [wgs_lng, wgs_lat] = gcj02towgs84(-74.006, 40.7128);
    expect(wgs_lng).toBe(-74.006);
    expect(wgs_lat).toBe(40.7128);
  });
});

// ============================================================
// 6. WGS84 <-> CGCS2000 原值返回
// ============================================================
describe("WGS84 <-> CGCS2000", () => {
  it("WGS84->CGCS2000 应原值返回", () => {
    const [cgcs_lng, cgcs_lat] = wgs84tocgcs2000(116.404, 39.915);
    expect(cgcs_lng).toBe(116.404);
    expect(cgcs_lat).toBe(39.915);
  });

  it("CGCS2000->WGS84 应原值返回", () => {
    const [wgs_lng, wgs_lat] = cgcs2000towgs84(116.404, 39.915);
    expect(wgs_lng).toBe(116.404);
    expect(wgs_lat).toBe(39.915);
  });

  it("WGS84->CGCS2000->WGS84 往返应无损失", () => {
    const [cgcs_lng, cgcs_lat] = wgs84tocgcs2000(121.474, 31.230);
    const [wgs_lng, wgs_lat] = cgcs2000towgs84(cgcs_lng, cgcs_lat);
    expect(wgs_lng).toBe(121.474);
    expect(wgs_lat).toBe(31.230);
  });
});

// ============================================================
// 7. CGCS2000 -> GCJ02 与 WGS84->GCJ02 一致
// ============================================================
describe("CGCS2000 -> GCJ02 一致性", () => {
  it("CGCS2000->GCJ02 应与 WGS84->GCJ02 结果一致", () => {
    const lng = 116.404;
    const lat = 39.915;

    const [wgs_gcj_lng, wgs_gcj_lat] = wgs84togcj02(lng, lat);
    const [cgcs_gcj_lng, cgcs_gcj_lat] = cgcs2000togcj02(lng, lat);

    expect(wgs_gcj_lng).toBe(cgcs_gcj_lng);
    expect(wgs_gcj_lat).toBe(cgcs_gcj_lat);
  });
});

// ============================================================
// 8. 全链路往返精度
// ============================================================
describe("全链路往返精度", () => {
  it("WGS84->GCJ02->BD09->GCJ02->WGS84 总误差应 < 0.01 度", () => {
    const orig_lng = 116.404;
    const orig_lat = 39.915;

    // WGS84 -> GCJ02
    const [gcj_lng, gcj_lat] = wgs84togcj02(orig_lng, orig_lat);
    // GCJ02 -> BD09
    const [bd_lng, bd_lat] = gcj02tobd09(gcj_lng, gcj_lat);
    // BD09 -> GCJ02
    const [gcj2_lng, gcj2_lat] = bd09togcj02(bd_lng, bd_lat);
    // GCJ02 -> WGS84
    const [wgs_lng, wgs_lat] = gcj02towgs84(gcj2_lng, gcj2_lat);

    const lngError = Math.abs(wgs_lng - orig_lng);
    const latError = Math.abs(wgs_lat - orig_lat);

    expect(
      lngError < 0.01,
      `经度往返误差: ${lngError} 度, 期望 < 0.01`
    ).toBe(true);
    expect(
      latError < 0.01,
      `纬度往返误差: ${latError} 度, 期望 < 0.01`
    ).toBe(true);
  });

  it("WGS84->BD09->WGS84 通过中转的往返误差应 < 0.01 度", () => {
    const orig_lng = 116.404;
    const orig_lat = 39.915;

    const [bd_lng, bd_lat] = wgs84tobd09(orig_lng, orig_lat);
    const [wgs_lng, wgs_lat] = bd09towgs84(bd_lng, bd_lat);

    expect(Math.abs(wgs_lng - orig_lng)).toBeLessThan(0.01);
    expect(Math.abs(wgs_lat - orig_lat)).toBeLessThan(0.01);
  });
});

// ============================================================
// 9. 通用 convert 函数测试
// ============================================================
describe("通用 convert 函数", () => {
  it("同坐标系应原值返回", () => {
    const [lng, lat] = convert(116.404, 39.915, "WGS84", "WGS84");
    expect(lng).toBe(116.404);
    expect(lat).toBe(39.915);
  });

  it("WGS84->GCJ02 应与专用函数一致", () => {
    const [c_lng, c_lat] = convert(116.404, 39.915, "WGS84", "GCJ02");
    const [d_lng, d_lat] = wgs84togcj02(116.404, 39.915);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("WGS84->BD09 应与专用函数一致", () => {
    const [c_lng, c_lat] = convert(116.404, 39.915, "WGS84", "BD09");
    const [d_lng, d_lat] = wgs84tobd09(116.404, 39.915);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("WGS84->CGCS2000 应原值返回", () => {
    const [lng, lat] = convert(116.404, 39.915, "WGS84", "CGCS2000");
    expect(lng).toBe(116.404);
    expect(lat).toBe(39.915);
  });

  it("GCJ02->WGS84 应与专用函数一致", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(116.404, 39.915);
    const [c_lng, c_lat] = convert(gcj_lng, gcj_lat, "GCJ02", "WGS84");
    const [d_lng, d_lat] = gcj02towgs84(gcj_lng, gcj_lat);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("BD09->GCJ02 应与专用函数一致", () => {
    const [bd_lng, bd_lat] = gcj02tobd09(116.404, 39.915);
    const [c_lng, c_lat] = convert(bd_lng, bd_lat, "BD09", "GCJ02");
    const [d_lng, d_lat] = bd09togcj02(bd_lng, bd_lat);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("CGCS2000->GCJ02 应与专用函数一致", () => {
    const [c_lng, c_lat] = convert(116.404, 39.915, "CGCS2000", "GCJ02");
    const [d_lng, d_lat] = cgcs2000togcj02(116.404, 39.915);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("CGCS2000->BD09 应正确工作", () => {
    const [c_lng, c_lat] = convert(116.404, 39.915, "CGCS2000", "BD09");
    // 应等于 WGS84->BD09 (因为 CGCS2000 ≈ WGS84)
    const [d_lng, d_lat] = wgs84tobd09(116.404, 39.915);
    expect(c_lng).toBe(d_lng);
    expect(c_lat).toBe(d_lat);
  });

  it("BD09->CGCS2000 应正确工作", () => {
    const [bd_lng, bd_lat] = wgs84tobd09(116.404, 39.915);
    const [c_lng, c_lat] = convert(bd_lng, bd_lat, "BD09", "CGCS2000");
    // 应接近原始 WGS84 值 (因为 CGCS2000 ≈ WGS84)
    expect(Math.abs(c_lng - 116.404)).toBeLessThan(0.01);
    expect(Math.abs(c_lat - 39.915)).toBeLessThan(0.01);
  });

  it("GCJ02->CGCS2000 应正确工作", () => {
    const [gcj_lng, gcj_lat] = wgs84togcj02(116.404, 39.915);
    const [c_lng, c_lat] = convert(gcj_lng, gcj_lat, "GCJ02", "CGCS2000");
    // 应接近原始 WGS84 值
    expect(Math.abs(c_lng - 116.404)).toBeLessThan(0.01);
    expect(Math.abs(c_lat - 39.915)).toBeLessThan(0.01);
  });
});

// ============================================================
// 10. 工具函数测试
// ============================================================
describe("工具函数", () => {
  describe("roundCoordinate", () => {
    it("默认保留6位小数", () => {
      expect(roundCoordinate(116.4041234567)).toBe(116.404123);
    });

    it("指定保留4位小数", () => {
      expect(roundCoordinate(116.4041234567, 4)).toBe(116.4041);
    });

    it("负数正确处理", () => {
      expect(roundCoordinate(-74.006456, 4)).toBe(-74.0065);
    });
  });

  describe("parseCoordinateLine", () => {
    it("逗号分隔正确解析", () => {
      const result = parseCoordinateLine("116.404,39.915");
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("空格分隔正确解析", () => {
      const result = parseCoordinateLine("116.404 39.915");
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("中文逗号分隔正确解析", () => {
      const result = parseCoordinateLine("116.404，39.915");
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("Tab分隔正确解析", () => {
      const result = parseCoordinateLine("116.404\t39.915");
      expect(result).toEqual({ lng: 116.404, lat: 39.915 });
    });

    it("空行返回 null", () => {
      expect(parseCoordinateLine("")).toBeNull();
      expect(parseCoordinateLine("   ")).toBeNull();
    });

    it("只有一个数字返回 null", () => {
      expect(parseCoordinateLine("116.404")).toBeNull();
    });

    it("非数字返回 null", () => {
      expect(parseCoordinateLine("abc,def")).toBeNull();
    });

    it("负数坐标正确解析", () => {
      const result = parseCoordinateLine("-74.006, 40.7128");
      expect(result).toEqual({ lng: -74.006, lat: 40.7128 });
    });
  });

  describe("parseCoordinates", () => {
    it("多行输入正确解析", () => {
      const result = parseCoordinates("116.404, 39.915\n121.474, 31.230");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ lng: 116.404, lat: 39.915 });
      expect(result[1]).toEqual({ lng: 121.474, lat: 31.230 });
    });

    it("空行应被跳过", () => {
      const result = parseCoordinates("116.404, 39.915\n\n121.474, 31.230");
      expect(result).toHaveLength(2);
    });

    it("无效行应被跳过", () => {
      const result = parseCoordinates("116.404, 39.915\ninvalid\n121.474, 31.230");
      expect(result).toHaveLength(2);
    });

    it("空文本返回空数组", () => {
      expect(parseCoordinates("")).toHaveLength(0);
      expect(parseCoordinates("\n\n")).toHaveLength(0);
    });
  });

  describe("isValidCoordinate", () => {
    it("有效坐标应返回 true", () => {
      expect(isValidCoordinate(116.404, 39.915)).toBe(true);
      expect(isValidCoordinate(-74.006, 40.7128)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
    });

    it("边界值应返回 true", () => {
      expect(isValidCoordinate(180, 90)).toBe(true);
      expect(isValidCoordinate(-180, -90)).toBe(true);
    });

    it("超出范围应返回 false", () => {
      expect(isValidCoordinate(181, 39.915)).toBe(false);
      expect(isValidCoordinate(116.404, 91)).toBe(false);
      expect(isValidCoordinate(-181, 39.915)).toBe(false);
      expect(isValidCoordinate(116.404, -91)).toBe(false);
    });

    it("NaN 应返回 false", () => {
      expect(isValidCoordinate(NaN, 39.915)).toBe(false);
      expect(isValidCoordinate(116.404, NaN)).toBe(false);
    });
  });

  describe("formatCoordinate", () => {
    it("默认6位小数格式化", () => {
      expect(formatCoordinate(116.404123, 39.915456)).toBe(
        "116.404123, 39.915456"
      );
    });

    it("指定4位小数格式化", () => {
      expect(formatCoordinate(116.404123, 39.915456, 4)).toBe(
        "116.4041, 39.9155"
      );
    });
  });
});

// ============================================================
// 11. 边界情况测试
// ============================================================
describe("边界情况", () => {
  it("经度 180 度边界", () => {
    // 180 度在 outOfChina 范围内, 应该原值返回
    const [gcj_lng, gcj_lat] = wgs84togcj02(180, 45);
    expect(gcj_lng).toBe(180);
    expect(gcj_lat).toBe(45);
  });

  it("零度坐标 (赤道和本初子午线交点)", () => {
    // (0, 0) 在中国境外, 应原值返回
    const [gcj_lng, gcj_lat] = wgs84togcj02(0, 0);
    expect(gcj_lng).toBe(0);
    expect(gcj_lat).toBe(0);
  });

  it("parseCoordinateLine 处理多余空格", () => {
    const result = parseCoordinateLine("  116.404 ,  39.915  ");
    expect(result).toEqual({ lng: 116.404, lat: 39.915 });
  });

  it("isValidCoordinate 边界精确测试", () => {
    // 恰好等于边界
    expect(isValidCoordinate(180, 90)).toBe(true);
    expect(isValidCoordinate(-180, -90)).toBe(true);
    // 恰好超出边界
    expect(isValidCoordinate(180.000001, 90)).toBe(false);
    expect(isValidCoordinate(-180, -90.000001)).toBe(false);
  });

  it("中国边境附近坐标应产生偏移", () => {
    // 经度 72.005 刚好在 outOfChina 边界内 (72.004 为境外)
    const [gcj_lng1, gcj_lat1] = wgs84togcj02(72.005, 40);
    expect(gcj_lng1).not.toBe(72.005); // 应有偏移

    // 经度 72.003 在境外
    const [gcj_lng2, gcj_lat2] = wgs84togcj02(72.003, 40);
    expect(gcj_lng2).toBe(72.003); // 应原值返回
  });
});
