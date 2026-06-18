/**
 * 坐标系转换工具 - 主应用
 *
 * 功能:
 * - Tab切换: 单点转换 | 批量转换
 * - 现代简洁浅色主题
 * - 响应式布局
 */

import { useState } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  Paper,
  Chip,
} from "@mui/material";
import ExploreIcon from "@mui/icons-material/Explore";
import SinglePointConverter from "./components/SinglePointConverter";
import BatchConverter from "./components/BatchConverter";

// 创建浅色主题
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
    },
    secondary: {
      main: "#dc004e",
    },
    background: {
      default: "#f5f7fa",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

/** Tab面板属性 */
interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

/**
 * Tab内容面板
 */
function TabPanel({ children, value, index }: TabPanelProps): JSX.Element | null {
  if (value !== index) return null;
  return (
    <Box sx={{ py: 3 }}>
      <>{children}</>
    </Box>
  );
}

/**
 * 主应用组件
 */
export default function App(): JSX.Element {
  const [tabIndex, setTabIndex] = useState<number>(0);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {/* 顶部标题栏 */}
        <AppBar position="sticky" elevation={1}>
          <Toolbar>
            <ExploreIcon sx={{ mr: 1.5 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              坐标系转换工具
            </Typography>
            <Chip
              label="WGS-84 · CGCS2000 · GCJ-02 · BD-09"
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                color: "white",
                display: { xs: "none", sm: "flex" },
              }}
            />
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 3 }}>
          {/* Tab切换 */}
          <Paper elevation={0} sx={{ mb: 0 }}>
            <Tabs
              value={tabIndex}
              onChange={(_, v: number) => setTabIndex(v)}
              indicatorColor="primary"
              textColor="primary"
              centered
            >
              <Tab label="单点转换" />
              <Tab label="批量转换" />
            </Tabs>
          </Paper>

          <TabPanel value={tabIndex} index={0}>
            <SinglePointConverter />
          </TabPanel>

          <TabPanel value={tabIndex} index={1}>
            <BatchConverter />
          </TabPanel>
        </Container>

        {/* 页脚 */}
        <Box
          component="footer"
          sx={{
            textAlign: "center",
            py: 2,
            color: "text.secondary",
            fontSize: "0.75rem",
          }}
        >
          坐标系转换工具 · 支持 WGS-84 / CGCS2000 / GCJ-02 / BD-09 互转
        </Box>
      </Box>
    </ThemeProvider>
  );
}
