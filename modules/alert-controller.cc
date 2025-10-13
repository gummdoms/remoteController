#include <windows.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <shellscalingapi.h>
#include <string>
#include <vector>
#include <cmath>

#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "shcore.lib")

#ifndef DWMWA_WINDOW_CORNER_PREFERENCE
#define DWMWA_WINDOW_CORNER_PREFERENCE 33
typedef enum _DWM_WINDOW_CORNER_PREFERENCE
{
    DWMWCP_DEFAULT = 0,
    DWMWCP_DONOTROUND = 1,
    DWMWCP_ROUND = 2,
    DWMWCP_ROUNDSMALL = 3
} DWM_WINDOW_CORNER_PREFERENCE;
#endif

#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
#define DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 ((DPI_AWARENESS_CONTEXT) - 4)
#endif

namespace
{
    struct AlertConfig
    {
        std::wstring primaryLine;
        std::wstring secondaryLine;
        UINT displaySeconds;
    };

    AlertConfig g_config = {
        L"Apagado en 5 minutos",
        L"El equipo se apagará pronto.",
        25u};

    Gdiplus::REAL g_scale = 1.0f;
    Gdiplus::RectF g_windowRect(0.0f, 0.0f, 420.0f, 140.0f);

    void EnableDpiAwareness()
    {
        if (HMODULE user32 = LoadLibraryW(L"user32.dll"))
        {
            using SetDpiContext = BOOL(WINAPI *)(DPI_AWARENESS_CONTEXT);
            auto setContext = reinterpret_cast<SetDpiContext>(GetProcAddress(user32, "SetProcessDpiAwarenessContext"));
            if (setContext)
            {
                if (setContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2))
                {
                    FreeLibrary(user32);
                    return;
                }
            }
            using SetProcessDpiAwareFn = BOOL(WINAPI *)(void);
            auto setDpiAware = reinterpret_cast<SetProcessDpiAwareFn>(GetProcAddress(user32, "SetProcessDPIAware"));
            if (setDpiAware)
            {
                setDpiAware();
                FreeLibrary(user32);
                return;
            }
            FreeLibrary(user32);
        }

        if (HMODULE shcore = LoadLibraryW(L"shcore.dll"))
        {
            using SetProcessDpiAwarenessFn = HRESULT(WINAPI *)(PROCESS_DPI_AWARENESS);
            auto setAwareness = reinterpret_cast<SetProcessDpiAwarenessFn>(GetProcAddress(shcore, "SetProcessDpiAwareness"));
            if (setAwareness)
            {
                setAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
            }
            FreeLibrary(shcore);
        }
    }

    UINT GetSystemDpi()
    {
        UINT dpi = 96;
        HDC screen = GetDC(nullptr);
        if (screen)
        {
            dpi = static_cast<UINT>(GetDeviceCaps(screen, LOGPIXELSX));
            ReleaseDC(nullptr, screen);
        }
        return dpi ? dpi : 96;
    }

    inline Gdiplus::REAL ScaleValue(Gdiplus::REAL value)
    {
        return value * g_scale;
    }

    void AddRoundedRect(Gdiplus::GraphicsPath &path, const Gdiplus::RectF &rect, Gdiplus::REAL radius)
    {
        const Gdiplus::REAL diameter = radius * 2.0f;
        Gdiplus::RectF corner(rect.X, rect.Y, diameter, diameter);

        path.AddArc(corner, 180.0f, 90.0f);
        corner.X = rect.GetRight() - diameter;
        path.AddArc(corner, 270.0f, 90.0f);
        corner.Y = rect.GetBottom() - diameter;
        path.AddArc(corner, 0.0f, 90.0f);
        corner.X = rect.X;
        path.AddArc(corner, 90.0f, 90.0f);
        path.CloseFigure();
    }

    void ParseArguments()
    {
        int argc = 0;
        wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
        if (!argv)
        {
            return;
        }

        if (argc > 1 && argv[1] && *argv[1])
        {
            g_config.primaryLine = argv[1];
        }

        if (argc > 2 && argv[2] && *argv[2])
        {
            g_config.secondaryLine = argv[2];
        }

        if (argc > 3 && argv[3])
        {
            int seconds = _wtoi(argv[3]);
            if (seconds > 0)
            {
                g_config.displaySeconds = static_cast<UINT>(seconds);
            }
        }

        LocalFree(argv);
    }

    void ApplyWindowStyling(HWND hwnd)
    {
        const DWORD exStyle = WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);
        SetLayeredWindowAttributes(hwnd, 0, 245, LWA_ALPHA);

        const DWM_WINDOW_CORNER_PREFERENCE preference = DWMWCP_ROUND;
        DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &preference, sizeof(preference));

        const MARGINS margins = {0, 0, 0, 0};
        DwmExtendFrameIntoClientArea(hwnd, &margins);
    }

    void CenterWindowOnScreen(HWND hwnd)
    {
        RECT rect = {};
        GetWindowRect(hwnd, &rect);
        const int width = rect.right - rect.left;
        const int height = rect.bottom - rect.top;

        RECT monitorRect = {};
        HMONITOR monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO info = {sizeof(MONITORINFO)};
        if (GetMonitorInfo(monitor, &info))
        {
            monitorRect = info.rcWork;
        }
        else
        {
            SystemParametersInfo(SPI_GETWORKAREA, 0, &monitorRect, 0);
        }

        const int x = monitorRect.left + ((monitorRect.right - monitorRect.left) - width) / 2;
        const int y = monitorRect.top + static_cast<int>(ScaleValue(80.0f));

        SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, SWP_SHOWWINDOW);
    }

    LRESULT CALLBACK WndProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam)
    {
        switch (message)
        {
        case WM_CREATE:
        {
            ApplyWindowStyling(hwnd);
            CenterWindowOnScreen(hwnd);
            SetTimer(hwnd, 1, g_config.displaySeconds * 1000u, nullptr);
            AnimateWindow(hwnd, 160, AW_BLEND);
            MessageBeep(MB_ICONINFORMATION);
            return 0;
        }
        case WM_TIMER:
        {
            KillTimer(hwnd, 1);
            AnimateWindow(hwnd, 120, AW_BLEND | AW_HIDE);
            DestroyWindow(hwnd);
            return 0;
        }
        case WM_LBUTTONUP:
        case WM_RBUTTONUP:
        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
        case WM_PAINT:
        {
            PAINTSTRUCT ps = {};
            HDC hdc = BeginPaint(hwnd, &ps);
            if (!hdc)
            {
                return 0;
            }

            Gdiplus::Graphics graphics(hdc);
            graphics.SetSmoothingMode(Gdiplus::SmoothingModeHighQuality);

            const Gdiplus::RectF canvas(0.0f, 0.0f, ScaleValue(g_windowRect.Width), ScaleValue(g_windowRect.Height));
            const Gdiplus::REAL radius = ScaleValue(26.0f);

            Gdiplus::GraphicsPath shadowPath;
            AddRoundedRect(shadowPath, canvas, radius);

            Gdiplus::SolidBrush shadowBrush(Gdiplus::Color(90, 0, 0, 0));
            Gdiplus::Matrix shadowMatrix;
            shadowMatrix.Translate(ScaleValue(4.0f), ScaleValue(4.0f));
            graphics.MultiplyTransform(&shadowMatrix);
            graphics.FillPath(&shadowBrush, &shadowPath);
            graphics.ResetTransform();

            Gdiplus::GraphicsPath backgroundPath;
            AddRoundedRect(backgroundPath, canvas, radius);
            Gdiplus::LinearGradientBrush backgroundBrush(
                canvas,
                Gdiplus::Color(240, 255, 216, 150),
                Gdiplus::Color(240, 240, 169, 90),
                90.0f);
            graphics.FillPath(&backgroundBrush, &backgroundPath);

            Gdiplus::Pen borderPen(Gdiplus::Color(80, 70, 55, 20), ScaleValue(1.6f));
            graphics.DrawPath(&borderPen, &backgroundPath);

            Gdiplus::RectF accent(canvas.X + ScaleValue(18.0f), canvas.Y + ScaleValue(18.0f), canvas.Width - ScaleValue(36.0f), ScaleValue(4.0f));
            Gdiplus::SolidBrush accentBrush(Gdiplus::Color(150, 255, 255, 255));
            graphics.FillRectangle(&accentBrush, accent);

            Gdiplus::FontFamily fontFamily(L"Segoe UI");
            Gdiplus::Font primaryFont(&fontFamily, ScaleValue(21.0f), Gdiplus::FontStyleBold, Gdiplus::UnitPixel);
            Gdiplus::Font secondaryFont(&fontFamily, ScaleValue(16.5f), Gdiplus::FontStyleRegular, Gdiplus::UnitPixel);

            Gdiplus::SolidBrush primaryBrush(Gdiplus::Color(230, 35, 35, 35));
            Gdiplus::SolidBrush secondaryBrush(Gdiplus::Color(200, 55, 55, 55));

            Gdiplus::RectF textRect(canvas.X + ScaleValue(26.0f), canvas.Y + ScaleValue(32.0f), canvas.Width - ScaleValue(52.0f), canvas.Height);
            graphics.DrawString(g_config.primaryLine.c_str(), -1, &primaryFont, textRect, nullptr, &primaryBrush);

            textRect.Y += ScaleValue(38.0f);
            graphics.DrawString(g_config.secondaryLine.c_str(), -1, &secondaryFont, textRect, nullptr, &secondaryBrush);

            EndPaint(hwnd, &ps);
            return 0;
        }
        default:
            break;
        }

        return DefWindowProc(hwnd, message, wParam, lParam);
    }
}

int APIENTRY wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int)
{
    EnableDpiAwareness();
    ParseArguments();

    const UINT dpi = GetSystemDpi();
    g_scale = static_cast<Gdiplus::REAL>(dpi) / 96.0f;

    Gdiplus::GdiplusStartupInput startupInput;
    ULONG_PTR gdiplusToken = 0;
    if (Gdiplus::GdiplusStartup(&gdiplusToken, &startupInput, nullptr) != Gdiplus::Ok)
    {
        return 0;
    }

    const wchar_t CLASS_NAME[] = L"ShutdownAlertWindow";

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground = reinterpret_cast<HBRUSH>(GetStockObject(NULL_BRUSH));
    wc.lpszClassName = CLASS_NAME;

    if (!RegisterClassExW(&wc))
    {
        Gdiplus::GdiplusShutdown(gdiplusToken);
        return 0;
    }

    const int width = static_cast<int>(std::round(ScaleValue(g_windowRect.Width)));
    const int height = static_cast<int>(std::round(ScaleValue(g_windowRect.Height)));

    HWND hwnd = CreateWindowExW(
        0,
        CLASS_NAME,
        L"",
        WS_POPUP,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        width,
        height,
        nullptr,
        nullptr,
        hInstance,
        nullptr);

    if (!hwnd)
    {
        Gdiplus::GdiplusShutdown(gdiplusToken);
        return 0;
    }

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    MSG msg = {};
    while (GetMessageW(&msg, nullptr, 0, 0) > 0)
    {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    Gdiplus::GdiplusShutdown(gdiplusToken);
    return static_cast<int>(msg.wParam);
}
