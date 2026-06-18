/**
 * 批量转换组件
 * 支持多行文本输入坐标，批量转换后以表格展示结果，支持复制和导出CSV
 */

import { useState, useCallback, useMemo } from "react";
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Paper,
  Typography,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Snackbar,
  Grid,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import TransformIcon from "@mui/icons-material/Transform";
import {
  COORDINATE_SYSTEMS,
  getSystemLabel,
  type CoordinateSystem,
  type ConversionResult,
} from "../types/coordinate";
import {
  convert,
  parseCoordinatesOrdered,
  roundCoordinate,
} from "../utils/coordinateTransform";
import MapPreview from "./MapPreview";

/**
 * 批量坐标转换器
 */
export default function BatchConverter(): JSX.Element {
  // 输入状态
  const [inputText, setInputText] = useState<string>(
    "116.404, 39.915\n121.474, 31.230\n113.264, 23.129"
  );
  const [fromSystem, setFromSystem] = useState<CoordinateSystem>("WGS84");
  const [toSystem, setToSystem] = useState<CoordinateSystem>("GCJ02");
  const [lngFirst, setLngFirst] = useState<boolean>(true);
  const [resultLngFirst, setResultLngFirst] = useState<boolean>(true);

  // 结果状态
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [error, setError] = useState<string>("");
  const [errorLines, setErrorLines] = useState<number[]>([]);
  const [snackOpen, setSnackOpen] = useState<boolean>(false);
  const [snackMsg, setSnackMsg] = useState<string>("");

  // 执行批量转换
  const handleConvert = useCallback(() => {
    setError("");
    setErrorLines([]);

    const coords = parseCoordinatesOrdered(inputText, lngFirst);
    if (coords.length === 0) {
      setError(
        lngFirst
          ? "未解析到有效坐标，请检查输入格式（每行: 经度,纬度）"
          : "未解析到有效坐标，请检查输入格式（每行: 纬度,经度）"
      );
      setResults([]);
      return;
    }

    // 检查无效行
    const lines = inputText.split("\n");
    const invalidLines: number[] = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed) {
        const parts = trimmed.split(/[\s,，\t]+/).filter((p) => p.length > 0);
        if (parts.length < 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
          invalidLines.push(index + 1);
        }
      }
    });

    if (invalidLines.length > 0) {
      setErrorLines(invalidLines);
    }

    // 执行转换
    const convertedResults: ConversionResult[] = coords.map((coord) => {
      const [targetLng, targetLat] = convert(
        coord.lng,
        coord.lat,
        fromSystem,
        toSystem
      );
      return {
        sourceLng: roundCoordinate(coord.lng),
        sourceLat: roundCoordinate(coord.lat),
        targetLng: roundCoordinate(targetLng),
        targetLat: roundCoordinate(targetLat),
        sourcePoint: { lng: coord.lng, lat: coord.lat },
        targetPoint: { lng: targetLng, lat: targetLat },
      };
    });

    setResults(convertedResults);
  }, [inputText, lngFirst, fromSystem, toSystem]);

  // 交换源/目标坐标系
  const handleSwapSystems = useCallback(() => {
    setFromSystem(toSystem);
    setToSystem(fromSystem);
    setResults([]);
  }, [fromSystem, toSystem]);

  // 复制全部结果到剪贴板
  const handleCopyAll = useCallback(async () => {
    if (results.length === 0) return;

    const lines: string[] = results.map((r) =>
      resultLngFirst
        ? `${r.targetLng}, ${r.targetLat}`
        : `${r.targetLat}, ${r.targetLng}`
    );
    const text: string = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setSnackMsg(`已复制 ${results.length} 条结果`);
      setSnackOpen(true);
    } catch {
      const textarea: HTMLTextAreaElement = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setSnackMsg(`已复制 ${results.length} 条结果`);
      setSnackOpen(true);
    }
  }, [results, resultLngFirst]);

  // 导出CSV文件
  const handleExportCSV = useCallback(() => {
    if (results.length === 0) return;

    const fromLabel: string = getSystemLabel(fromSystem);
    const toLabel: string = getSystemLabel(toSystem);

    const csvLines: string[] = [];
    if (resultLngFirst) {
      csvLines.push(`序号,源经度(${fromLabel}),源纬度(${fromLabel}),目标经度(${toLabel}),目标纬度(${toLabel})`);
    } else {
      csvLines.push(`序号,源纬度(${fromLabel}),源经度(${fromLabel}),目标纬度(${toLabel}),目标经度(${toLabel})`);
    }
    results.forEach((r, index) => {
      if (resultLngFirst) {
        csvLines.push(`${index + 1},${r.sourceLng},${r.sourceLat},${r.targetLng},${r.targetLat}`);
      } else {
        csvLines.push(`${index + 1},${r.sourceLat},${r.sourceLng},${r.targetLat},${r.targetLng}`);
      }
    });

    const csvContent: string = "\uFEFF" + csvLines.join("\n");
    const blob: Blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url: string = URL.createObjectURL(blob);
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = `coordinate_conversion_${fromSystem}_to_${toSystem}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSnackMsg("CSV文件已导出");
    setSnackOpen(true);
  }, [results, fromSystem, toSystem, resultLngFirst]);

  // 偏移量统计（仅用于显示，不修改状态）
  const offsetInfo = useMemo(() => {
    if (results.length === 0) return null;
    const first = results[0];
    const dLng = first.targetLng - first.sourceLng;
    const dLat = first.targetLat - first.sourceLat;
    return { dLng: roundCoordinate(dLng), dLat: roundCoordinate(dLat) };
  }, [results]);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          批量坐标转换
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {/* 坐标系选择 */}
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={5} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>源坐标系</InputLabel>
              <Select
                value={fromSystem}
                label="源坐标系"
                onChange={(e) =>
                  setFromSystem(e.target.value as CoordinateSystem)
                }
              >
                {COORDINATE_SYSTEMS.map((sys) => (
                  <MenuItem key={sys.value} value={sys.value}>
                    <Box>
                      <Typography variant="body2" component="span">
                        {sys.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        component="span"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        {sys.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={2} sm={2} sx={{ textAlign: "center" }}>
            <Tooltip title="交换源/目标坐标系">
              <IconButton onClick={handleSwapSystems} size="small">
                <SwapHorizIcon />
              </IconButton>
            </Tooltip>
          </Grid>

          <Grid item xs={5} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>目标坐标系</InputLabel>
              <Select
                value={toSystem}
                label="目标坐标系"
                onChange={(e) =>
                  setToSystem(e.target.value as CoordinateSystem)
                }
              >
                {COORDINATE_SYSTEMS.map((sys) => (
                  <MenuItem key={sys.value} value={sys.value}>
                    <Box>
                      <Typography variant="body2" component="span">
                        {sys.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        component="span"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        {sys.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* 文本输入区 */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={8}
            label={
              lngFirst
                ? "输入坐标（每行: 经度,纬度，支持逗号或空格分隔）"
                : "输入坐标（每行: 纬度,经度，支持逗号或空格分隔）"
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              lngFirst
                ? "116.404, 39.915\n121.474, 31.230\n113.264, 23.129"
                : "39.915, 116.404\n31.230, 121.474\n23.129, 113.264"
            }
            sx={{ fontFamily: "monospace" }}
          />
          <Tooltip title="切换经纬度顺序">
            <IconButton
              onClick={() => {
                setLngFirst((prev) => !prev);
                setResults([]);
              }}
              size="small"
              sx={{ mt: 1 }}
            >
              <SwapVertIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            onClick={handleConvert}
            startIcon={<TransformIcon />}
          >
            批量转换
          </Button>
          {results.length > 0 && (
            <>
              <Button
                variant="outlined"
                onClick={handleCopyAll}
                startIcon={<ContentCopyIcon />}
              >
                复制结果
              </Button>
              <Button
                variant="outlined"
                onClick={handleExportCSV}
                startIcon={<DownloadIcon />}
              >
                导出CSV
              </Button>
            </>
          )}
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* 无效行提示 */}
        {errorLines.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            第 {errorLines.join(", ")} 行格式无效，已跳过
          </Alert>
        )}

        {/* 偏移信息 */}
        {offsetInfo && (
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            <Typography variant="body2">
              首条偏移量: 经度 {offsetInfo.dLng > 0 ? "+" : ""}
              {offsetInfo.dLng}°, 纬度 {offsetInfo.dLat > 0 ? "+" : ""}
              {offsetInfo.dLat}°
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* 结果表格 */}
      {results.length > 0 && (
        <Paper elevation={2} sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="subtitle2">
              转换结果 ({getSystemLabel(fromSystem)} →{" "}
              {getSystemLabel(toSystem)}) · 共 {results.length} 条
            </Typography>
            <Tooltip title="切换结果经纬度顺序">
              <IconButton
                onClick={() => setResultLngFirst((prev) => !prev)}
                size="small"
              >
                <SwapVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ width: 60 }}>
                    序号
                  </TableCell>
                  {(resultLngFirst
                    ? [
                        { label: "源经度", sys: fromSystem },
                        { label: "源纬度", sys: fromSystem },
                        { label: "目标经度", sys: toSystem },
                        { label: "目标纬度", sys: toSystem },
                      ]
                    : [
                        { label: "源纬度", sys: fromSystem },
                        { label: "源经度", sys: fromSystem },
                        { label: "目标纬度", sys: toSystem },
                        { label: "目标经度", sys: toSystem },
                      ]
                  ).map((col, i) => (
                    <TableCell key={i} align="right">
                      {col.label}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {getSystemLabel(col.sys)}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, index) => {
                  const cells: number[] = resultLngFirst
                    ? [r.sourceLng, r.sourceLat, r.targetLng, r.targetLat]
                    : [r.sourceLat, r.sourceLng, r.targetLat, r.targetLng];
                  return (
                    <TableRow
                      key={index}
                      sx={{
                        "&:nth-of-type(odd)": { bgcolor: "#fafafa" },
                      }}
                    >
                      <TableCell align="center">{index + 1}</TableCell>
                      {cells.map((val, i) => (
                        <TableCell
                          key={i}
                          align="right"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: i >= 2 ? 600 : 400,
                          }}
                        >
                          {val}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 批量地图预览 */}
      {results.length > 0 && (
        <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            批量坐标地图预览
          </Typography>
          <Box
            sx={{
              height: 400,
              position: "relative",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <MapPreview
              points={results.map((r, i) => ({
                lng: r.targetPoint.lng,
                lat: r.targetPoint.lat,
                label: `点${i + 1}`,
              }))}
              targetSystem={toSystem}
            />
          </Box>
        </Paper>
      )}

      {/* 复制/导出成功提示 */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message={snackMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
