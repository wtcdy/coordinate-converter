/**
 * 单点转换组件
 * 输入单个经纬度坐标，选择源/目标坐标系，执行转换并显示结果
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
  Tooltip,
  IconButton,
  Snackbar,
  Grid,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import {
  COORDINATE_SYSTEMS,
  getSystemLabel,
  type CoordinateSystem,
  type LngLat,
} from "../types/coordinate";
import {
  convert,
  roundCoordinate,
  isValidCoordinate,
  parseCoordinateLineOrdered,
  formatCoordinateOrdered,
} from "../utils/coordinateTransform";
import MapPreview from "./MapPreview";

/**
 * 单点坐标转换器
 */
export default function SinglePointConverter(): JSX.Element {
  // 输入状态
  const [coordStr, setCoordStr] = useState<string>("116.404, 39.915");
  const [lngFirst, setLngFirst] = useState<boolean>(true);
  const [resultLngFirst, setResultLngFirst] = useState<boolean>(true);
  const [fromSystem, setFromSystem] = useState<CoordinateSystem>("WGS84");
  const [toSystem, setToSystem] = useState<CoordinateSystem>("GCJ02");

  // 结果状态
  const [result, setResult] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string>("");
  const [showMap, setShowMap] = useState<boolean>(false);
  const [snackOpen, setSnackOpen] = useState<boolean>(false);

  // 执行转换
  const handleConvert = useCallback(() => {
    setError("");
    setResult(null);

    const parsed: LngLat | null = parseCoordinateLineOrdered(coordStr, lngFirst);
    if (!parsed) {
      setError("请输入有效的经纬度数值（逗号或空格分隔）");
      return;
    }

    const { lng, lat } = parsed;

    if (!isValidCoordinate(lng, lat)) {
      setError("经度范围: -180~180, 纬度范围: -90~90");
      return;
    }

    const converted: [number, number] = convert(lng, lat, fromSystem, toSystem);
    setResult(converted);
    setShowMap(true);
  }, [coordStr, lngFirst, fromSystem, toSystem]);

  // 交换源/目标坐标系
  const handleSwapSystems = useCallback(() => {
    setFromSystem(toSystem);
    setToSystem(fromSystem);
    // 如果已有结果，也需要清除
    setResult(null);
    setShowMap(false);
  }, [fromSystem, toSystem]);

  // 复制结果到剪贴板
  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text: string = formatCoordinateOrdered(
      result[0],
      result[1],
      resultLngFirst
    );
    try {
      await navigator.clipboard.writeText(text);
      setSnackOpen(true);
    } catch {
      // 降级处理
      const textarea: HTMLTextAreaElement = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setSnackOpen(true);
    }
  }, [result, resultLngFirst]);

  // 地图数据
  const sourcePoint: LngLat | null = useMemo(() => {
    if (!result) return null;
    const parsed: LngLat | null = parseCoordinateLineOrdered(coordStr, lngFirst);
    if (!parsed) return null;
    return parsed;
  }, [result, coordStr, lngFirst]);

  const targetPoint: LngLat | null = useMemo(() => {
    if (!result) return null;
    return { lng: result[0], lat: result[1] };
  }, [result]);

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          单点坐标转换
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
                onChange={(e) => setToSystem(e.target.value as CoordinateSystem)}
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

        {/* 经纬度输入 */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label={lngFirst ? "经度, 纬度" : "纬度, 经度"}
            value={coordStr}
            onChange={(e) => setCoordStr(e.target.value)}
            placeholder="如: 116.404, 39.915（逗号或空格分隔）"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleConvert();
              }
            }}
          />
          <Tooltip title="切换经纬度顺序">
            <IconButton
              onClick={() => {
                setLngFirst((prev) => !prev);
                setResult(null);
                setShowMap(false);
              }}
              size="small"
              sx={{ mt: 0.5 }}
            >
              <SwapVertIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleConvert}
            startIcon={<MyLocationIcon />}
          >
            转换
          </Button>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 转换结果 */}
        {result && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              转换结果 ({getSystemLabel(fromSystem)} → {getSystemLabel(toSystem)})
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: "#f8f9fa",
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {resultLngFirst ? "经度" : "纬度"}:{" "}
                  {roundCoordinate(resultLngFirst ? result[0] : result[1])}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {resultLngFirst ? "纬度" : "经度"}:{" "}
                  {roundCoordinate(resultLngFirst ? result[1] : result[0])}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Tooltip title="切换结果经纬度顺序">
                  <IconButton
                    onClick={() => setResultLngFirst((prev) => !prev)}
                    size="small"
                  >
                    <SwapVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="复制结果">
                  <IconButton onClick={handleCopy} size="small">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          </Box>
        )}
      </Paper>

      {/* 地图预览 */}
      {showMap && sourcePoint && targetPoint && (
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            地图位置对比
          </Typography>
          <Box
            sx={{
              height: 350,
              position: "relative",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <MapPreview
              sourcePoint={sourcePoint}
              targetPoint={targetPoint}
              sourceLabel={`源: ${getSystemLabel(fromSystem)}`}
              targetLabel={`目标: ${getSystemLabel(toSystem)}`}
              targetSystem={toSystem}
              sourceSystem={fromSystem}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 3, mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: "#1976d2",
                  border: "2px solid white",
                  boxShadow: "0 0 2px rgba(0,0,0,0.3)",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                源坐标 ({getSystemLabel(fromSystem)})
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: "#d32f2f",
                  border: "2px solid white",
                  boxShadow: "0 0 2px rgba(0,0,0,0.3)",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                目标坐标 ({getSystemLabel(toSystem)})
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* 复制成功提示 */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="已复制到剪贴板"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
