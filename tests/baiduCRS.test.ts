/**
 * 百度 BD-09 CRS 模块测试
 * @vitest-environment jsdom
 *
 * 测试内容:
 * 1. BD-09 <-> 百度墨卡托 转换正确性
 * 2. 往返转换 (round-trip) 精度
 * 3. 已知参考点转换精度
 * 4. MC2LL / LL2MC 系数数组完整性
 * 5. 边界情况处理
 * 6. BaiduCRS 对象属性验证
 */

import { describe, it, expect } from "vitest";
import {
  bd09ToMercator,
  mercatorToBd09,
  isBaiduCRS,
  BaiduCRS,
} from "../src/utils/baiduCRS";

// ============================================================
// 参考数据：来自百度地图 JS API 官方实现
// 北京天安门 BD-09: (116.404, 39.915)
// 上海东方明珠 BD-09: (121.499, 31.240)
// 广州塔 BD-09: (113.324, 23.106)
// ============================================================

describe("百度 BD-09 坐标转换", () => {
  // ----------------------------------------------------------
  // 1. 基本转换功能测试
  // ----------------------------------------------------------
  describe("bd09ToMercator - BD-09 经纬度转百度墨卡托", () => {
    it("北京天安门 BD-09 坐标应转换到合理的墨卡托范围", () => {
      const [mx, my] = bd09ToMercator(116.404, 39.915);
      // 百度墨卡托 X 对于东经 116° 应在 12,000,000 ~ 14,000,000 之间
      expect(mx).toBeGreaterThan(10000000);
      expect(mx).toBeLessThan(15000000);
      // 百度墨卡托 Y 对于北纬 39° 应在 3,000,000 ~ 7,000,000 之间
      expect(my).toBeGreaterThan(3000000);
      expect(my).toBeLessThan(7000000);
    });

    it("上海东方明珠 BD-09 坐标应转换到合理的墨卡托范围", () => {
      const [mx, my] = bd09ToMercator(121.499, 31.240);
      expect(mx).toBeGreaterThan(12000000);
      expect(mx).toBeLessThan(16000000);
      expect(my).toBeGreaterThan(2000000);
      expect(my).toBeLessThan(5000000);
    });

    it("经度为 0 时墨卡托 X 应接近 0", () => {
      const [mx] = bd09ToMercator(0, 39.915);
      expect(Math.abs(mx)).toBeLessThan(100);
    });

    it("转换结果应为有限数值", () => {
      const [mx, my] = bd09ToMercator(116.404, 39.915);
      expect(Number.isFinite(mx)).toBe(true);
      expect(Number.isFinite(my)).toBe(true);
    });
  });

  describe("mercatorToBd09 - 百度墨卡托转 BD-09 经纬度", () => {
    it("应将北京区域的墨卡托坐标转换回合理的经纬度范围", () => {
      // 先用正向转换获取参考墨卡托坐标
      const [mx, my] = bd09ToMercator(116.404, 39.915);
      const [lng, lat] = mercatorToBd09(mx, my);
      // 经度应在 110 ~ 120 之间
      expect(lng).toBeGreaterThan(110);
      expect(lng).toBeLessThan(120);
      // 纬度应在 35 ~ 45 之间
      expect(lat).toBeGreaterThan(35);
      expect(lat).toBeLessThan(45);
    });

    it("转换结果应为有限数值", () => {
      const [mx, my] = bd09ToMercator(116.404, 39.915);
      const [lng, lat] = mercatorToBd09(mx, my);
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 2. 往返转换 (Round-trip) 精度测试
  // ----------------------------------------------------------
  describe("往返转换精度", () => {
    it("北京天安门 round-trip 误差应小于 0.001 度", () => {
      const lng = 116.404;
      const lat = 39.915;
      const [mx, my] = bd09ToMercator(lng, lat);
      const [rlng, rlat] = mercatorToBd09(mx, my);
      expect(Math.abs(rlng - lng)).toBeLessThan(0.001);
      expect(Math.abs(rlat - lat)).toBeLessThan(0.001);
    });

    it("上海东方明珠 round-trip 误差应小于 0.001 度", () => {
      const lng = 121.499;
      const lat = 31.240;
      const [mx, my] = bd09ToMercator(lng, lat);
      const [rlng, rlat] = mercatorToBd09(mx, my);
      expect(Math.abs(rlng - lng)).toBeLessThan(0.001);
      expect(Math.abs(rlat - lat)).toBeLessThan(0.001);
    });

    it("广州塔 round-trip 误差应小于 0.001 度", () => {
      const lng = 113.324;
      const lat = 23.106;
      const [mx, my] = bd09ToMercator(lng, lat);
      const [rlng, rlat] = mercatorToBd09(mx, my);
      expect(Math.abs(rlng - lng)).toBeLessThan(0.001);
      expect(Math.abs(rlat - lat)).toBeLessThan(0.001);
    });

    it("哈尔滨 round-trip 误差应小于 0.001 度 (高纬度)", () => {
      const lng = 126.642;
      const lat = 45.757;
      const [mx, my] = bd09ToMercator(lng, lat);
      const [rlng, rlat] = mercatorToBd09(mx, my);
      expect(Math.abs(rlng - lng)).toBeLessThan(0.001);
      expect(Math.abs(rlat - lat)).toBeLessThan(0.001);
    });

    it("三亚 round-trip 误差应小于 0.001 度 (低纬度)", () => {
      const lng = 109.508;
      const lat = 18.253;
      const [mx, my] = bd09ToMercator(lng, lat);
      const [rlng, rlat] = mercatorToBd09(mx, my);
      expect(Math.abs(rlng - lng)).toBeLessThan(0.001);
      expect(Math.abs(rlat - lat)).toBeLessThan(0.001);
    });
  });

  // ----------------------------------------------------------
  // 3. 与百度官方转换结果的对比测试
  // ----------------------------------------------------------
  describe("与百度官方转换结果对比", () => {
    it("北京天安门 BD-09 (116.404, 39.915) 转墨卡托应与官方结果接近", () => {
      const [mx, my] = bd09ToMercator(116.404, 39.915);
      // 百度官方 JS API 多项式系数计算结果:
      // x ≈ 12958175, y ≈ 4825924 (百度墨卡托)
      // 标准Web墨卡托对比: x ≈ 12958034 (仅作参照)
      // 允许 ±2000 米误差（不同API版本系数可能有微小差异）
      expect(Math.abs(mx - 12958175)).toBeLessThan(2000);
      expect(Math.abs(my - 4825924)).toBeLessThan(2000);
    });
  });
});

// ============================================================
// 系数数组完整性测试
// ============================================================
describe("系数数组完整性", () => {
  it("MC2LL 应有 6 行系数", () => {
    // 通过测试转换功能间接验证系数可用性
    // 直接检查需要读取源文件
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    // MC2LL 每行应有 10 个系数（百度官方格式）
    const mc2llMatch = source.match(
      /const MC2LL:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(mc2llMatch).not.toBeNull();

    // 统计 MC2LL 数组中的行数
    const mc2llContent = mc2llMatch![1];
    const rows = mc2llContent.split(/\],/).length;
    expect(rows).toBe(6);
  });

  it("LL2MC 应有 6 行系数", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    const ll2mcMatch = source.match(
      /const LL2MC:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(ll2mcMatch).not.toBeNull();

    const ll2mcContent = ll2mcMatch![1];
    const rows = ll2mcContent.split(/\],/).length;
    expect(rows).toBe(6);
  });

  it("MC2LL 每行应有 10 个系数（百度官方格式）", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    const mc2llMatch = source.match(
      /const MC2LL:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(mc2llMatch).not.toBeNull();

    // 提取每行的数值个数
    const mc2llContent = mc2llMatch![1];
    const rowMatches = mc2llContent.match(/\[[^\]]+\]/g);
    expect(rowMatches).not.toBeNull();
    expect(rowMatches!.length).toBe(6);

    for (const row of rowMatches!) {
      const numbers = row.match(/-?[\d.eE+-]+/g);
      expect(numbers).not.toBeNull();
      // 百度官方格式每行 10 个系数
      expect(numbers!.length).toBe(10);
    }
  });

  it("LL2MC 每行应有 10 个系数（百度官方格式）", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    const ll2mcMatch = source.match(
      /const LL2MC:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(ll2mcMatch).not.toBeNull();

    const ll2mcContent = ll2mcMatch![1];
    const rowMatches = ll2mcContent.match(/\[[^\]]+\]/g);
    expect(rowMatches).not.toBeNull();
    expect(rowMatches!.length).toBe(6);

    for (const row of rowMatches!) {
      const numbers = row.match(/-?[\d.eE+-]+/g);
      expect(numbers).not.toBeNull();
      // 百度官方格式每行 10 个系数
      expect(numbers!.length).toBe(10);
    }
  });

  it("MC2LL 系数不应全部相同（各纬度带应有不同系数）", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    const mc2llMatch = source.match(
      /const MC2LL:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(mc2llMatch).not.toBeNull();

    const mc2llContent = mc2llMatch![1];
    const rowMatches = mc2llContent.match(/\[[^\]]+\]/g);
    expect(rowMatches).not.toBeNull();

    // 第1行和第6行不应完全相同
    expect(rowMatches![0]).not.toBe(rowMatches![5]);
    // 第3~6行不应完全相同（当前代码中后4行完全一样，这是错误的）
    expect(rowMatches![2]).not.toBe(rowMatches![3]);
    expect(rowMatches![3]).not.toBe(rowMatches![4]);
    expect(rowMatches![4]).not.toBe(rowMatches![5]);
  });

  it("MC2LL 的 c3~c8 系数不应全为 0", () => {
    const fs = require("fs");
    const path = require("path");
    const sourcePath = path.resolve(
      __dirname,
      "../src/utils/baiduCRS.ts"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    const mc2llMatch = source.match(
      /const MC2LL:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\];/
    );
    expect(mc2llMatch).not.toBeNull();

    const mc2llContent = mc2llMatch![1];
    const rowMatches = mc2llContent.match(/\[[^\]]+\]/g);
    expect(rowMatches).not.toBeNull();

    // 至少第1行的 c3~c8 不应全为 0
    const firstRow = rowMatches![0];
    const numbers = firstRow.match(/-?[\d.eE+-]+/g)!.map(Number);
    // c3~c8 (index 3-8) 中应至少有一个非零值
    const hasNonZero = numbers.slice(3, 9).some((n) => Math.abs(n) > 1e-15);
    expect(hasNonZero).toBe(true);
  });
});

// ============================================================
// BaiduCRS 对象属性测试
// ============================================================
describe("BaiduCRS 对象", () => {
  it("code 应为 'BD:09'", () => {
    expect(BaiduCRS.code).toBe("BD:09");
  });

  it("应有 projection 属性", () => {
    expect(BaiduCRS.projection).toBeDefined();
  });

  it("projection 应有 project 和 unproject 方法", () => {
    expect(typeof BaiduCRS.projection.project).toBe("function");
    expect(typeof BaiduCRS.projection.unproject).toBe("function");
  });

  it("projection 应有 bounds 属性", () => {
    expect(BaiduCRS.projection.bounds).toBeDefined();
  });

  it("应有 transformation 属性", () => {
    expect(BaiduCRS.transformation).toBeDefined();
  });

  it("scale(10) 应返回 256 * 2^10 = 262144", () => {
    const scale = (BaiduCRS as any).scale(10);
    expect(scale).toBe(262144);
  });

  it("zoom(262144) 应返回 10", () => {
    const zoom = (BaiduCRS as any).zoom(262144);
    expect(Math.abs(zoom - 10)).toBeLessThan(0.001);
  });

  it("distance 方法应返回合理的距离值", () => {
    const L = require("leaflet");
    const latlng1 = L.latLng(39.915, 116.404);
    const latlng2 = L.latLng(31.240, 121.499);
    const dist = (BaiduCRS as any).distance(latlng1, latlng2);
    // 北京到上海约 1000~1100 km
    expect(dist).toBeGreaterThan(900000);
    expect(dist).toBeLessThan(1200000);
  });

  it("projection project/unproject 应实现 round-trip", () => {
    const L = require("leaflet");
    const original = L.latLng(39.915, 116.404);
    const projected = BaiduCRS.projection.project(original);
    const recovered = BaiduCRS.projection.unproject(projected);
    expect(Math.abs(recovered.lat - original.lat)).toBeLessThan(0.001);
    expect(Math.abs(recovered.lng - original.lng)).toBeLessThan(0.001);
  });
});

// ============================================================
// isBaiduCRS 测试
// ============================================================
describe("isBaiduCRS", () => {
  it("BaiduCRS 对象应返回 true", () => {
    expect(isBaiduCRS(BaiduCRS)).toBe(true);
  });

  it("带 code='BD:09' 的对象应返回 true", () => {
    expect(isBaiduCRS({ code: "BD:09" })).toBe(true);
  });

  it("EPSG3857 应返回 false", () => {
    const L = require("leaflet");
    expect(isBaiduCRS(L.CRS.EPSG3857)).toBe(false);
  });

  it("null 和 undefined 应返回 false", () => {
    expect(isBaiduCRS(null)).toBe(false);
    expect(isBaiduCRS(undefined)).toBe(false);
  });

  it("普通对象应返回 false", () => {
    expect(isBaiduCRS({})).toBe(false);
    expect(isBaiduCRS({ code: "EPSG:3857" })).toBe(false);
  });
});
