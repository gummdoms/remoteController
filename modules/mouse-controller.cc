#include <napi.h>
#include <algorithm>
#include <map>
#include <string>
#include <vector>

#ifdef _WIN32

#include <windows.h>

namespace
{
    bool NeedsExtendedKeyFlag(WORD vk, bool forceExtended = false)
    {
        if (forceExtended)
        {
            return true;
        }
        switch (vk)
        {
        case VK_LEFT:
        case VK_RIGHT:
        case VK_UP:
        case VK_DOWN:
        case VK_HOME:
        case VK_END:
        case VK_PRIOR:
        case VK_NEXT:
        case VK_INSERT:
        case VK_DELETE:
        case VK_DIVIDE:
        case VK_NUMLOCK:
        case VK_RCONTROL:
        case VK_RMENU:
        case VK_LWIN:
        case VK_RWIN:
            return true;
        default:
            return false;
        }
    }

    bool IsModifierKey(WORD vk)
    {
        switch (vk)
        {
        case VK_SHIFT:
        case VK_LSHIFT:
        case VK_RSHIFT:
        case VK_CONTROL:
        case VK_LCONTROL:
        case VK_RCONTROL:
        case VK_MENU:
        case VK_LMENU:
        case VK_RMENU:
        case VK_LWIN:
        case VK_RWIN:
            return true;
        default:
            return false;
        }
    }

    WORD GetScanCode(WORD vk)
    {
        WORD scanCode = static_cast<WORD>(MapVirtualKey(vk, MAPVK_VK_TO_VSC));
        if (scanCode)
        {
            return scanCode;
        }

        static const std::map<WORD, WORD> NUMPAD_SCAN_CODES = {
            {VK_NUMPAD0, 0x52}, {VK_NUMPAD1, 0x4F}, {VK_NUMPAD2, 0x50}, {VK_NUMPAD3, 0x51},
            {VK_NUMPAD4, 0x4B}, {VK_NUMPAD5, 0x4C}, {VK_NUMPAD6, 0x4D}, {VK_NUMPAD7, 0x47},
            {VK_NUMPAD8, 0x48}, {VK_NUMPAD9, 0x49}, {VK_DECIMAL, 0x53}, {VK_DIVIDE, 0x35},
            {VK_MULTIPLY, 0x37}, {VK_SUBTRACT, 0x4A}, {VK_ADD, 0x4E}};

        auto it = NUMPAD_SCAN_CODES.find(vk);
        return it != NUMPAD_SCAN_CODES.end() ? it->second : 0;
    }

    bool IsNumpadVirtualKey(WORD vk)
    {
        return (vk >= VK_NUMPAD0 && vk <= VK_NUMPAD9)
            || vk == VK_MULTIPLY || vk == VK_ADD || vk == VK_SEPARATOR
            || vk == VK_SUBTRACT || vk == VK_DECIMAL || vk == VK_DIVIDE;
    }

    void SendVirtualKeyEvent(WORD vk, bool keyDown, bool forceExtended = false)
    {
        INPUT input = {};
        input.type = INPUT_KEYBOARD;

        WORD scanCode = GetScanCode(vk);
        if (scanCode)
        {
            input.ki.wScan = scanCode;
            input.ki.dwFlags = KEYEVENTF_SCANCODE;
            // Numpad físico: solo scan code (wVk=0) — más fiel al hardware real.
            if (!IsNumpadVirtualKey(vk))
            {
                input.ki.wVk = vk;
            }
        }
        else
        {
            input.ki.wVk = vk;
        }

        if (NeedsExtendedKeyFlag(vk, forceExtended))
        {
            input.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
        }

        if (!keyDown)
        {
            input.ki.dwFlags |= KEYEVENTF_KEYUP;
        }

        SendInput(1, &input, sizeof(INPUT));
    }

    void SendVirtualKeyPress(WORD vk, bool forceExtended = false)
    {
        SendVirtualKeyEvent(vk, true, forceExtended);
        SendVirtualKeyEvent(vk, false, forceExtended);
    }

    bool NeedsExtendedKeyName(const std::string &key)
    {
        return key == "numpadenter" || key == "numpaddivide";
    }

    void SendUnicodeCharacter(wchar_t ch)
    {
        INPUT inputs[2] = {};

        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;
        inputs[0].ki.wScan = ch;

        inputs[1] = inputs[0];
        inputs[1].ki.dwFlags |= KEYEVENTF_KEYUP;

        SendInput(2, inputs, sizeof(INPUT));
    }

    std::wstring Utf8ToWide(const std::string &input)
    {
        if (input.empty())
        {
            return L"";
        }

        int required = MultiByteToWideChar(CP_UTF8, 0, input.c_str(), -1, nullptr, 0);
        if (required <= 0)
        {
            return L"";
        }

        std::wstring output(static_cast<size_t>(required), L'\0');
        MultiByteToWideChar(CP_UTF8, 0, input.c_str(), -1, &output[0], required);
        if (!output.empty() && output.back() == L'\0')
        {
            output.pop_back();
        }
        return output;
    }

    const std::map<std::string, WORD> SPECIAL_KEY_MAP = {
        {"backspace", VK_BACK}, {"enter", VK_RETURN}, {"return", VK_RETURN}, {"space", VK_SPACE}, {"tab", VK_TAB}, {"esc", VK_ESCAPE}, {"escape", VK_ESCAPE}, {"delete", VK_DELETE}, {"del", VK_DELETE}, {"insert", VK_INSERT}, {"home", VK_HOME}, {"end", VK_END}, {"pageup", VK_PRIOR}, {"pagedown", VK_NEXT}, {"up", VK_UP}, {"down", VK_DOWN}, {"left", VK_LEFT}, {"right", VK_RIGHT}, {"capslock", VK_CAPITAL}, {"numlock", VK_NUMLOCK}, {"scrolllock", VK_SCROLL}, {"numpad0", VK_NUMPAD0}, {"numpad1", VK_NUMPAD1}, {"numpad2", VK_NUMPAD2}, {"numpad3", VK_NUMPAD3}, {"numpad4", VK_NUMPAD4}, {"numpad5", VK_NUMPAD5}, {"numpad6", VK_NUMPAD6}, {"numpad7", VK_NUMPAD7}, {"numpad8", VK_NUMPAD8}, {"numpad9", VK_NUMPAD9}, {"numpadadd", VK_ADD}, {"numpadsubtract", VK_SUBTRACT}, {"numpadmultiply", VK_MULTIPLY}, {"numpaddivide", VK_DIVIDE}, {"numpaddecimal", VK_DECIMAL}, {"numpadenter", VK_RETURN}, {"printscreen", VK_SNAPSHOT}, {"pause", VK_PAUSE}, {"pausebreak", VK_PAUSE}, {"f1", VK_F1}, {"f2", VK_F2}, {"f3", VK_F3}, {"f4", VK_F4}, {"f5", VK_F5}, {"f6", VK_F6}, {"f7", VK_F7}, {"f8", VK_F8}, {"f9", VK_F9}, {"f10", VK_F10}, {"f11", VK_F11}, {"f12", VK_F12}, {"media_play", VK_MEDIA_PLAY_PAUSE}, {"media_stop", VK_MEDIA_STOP}, {"media_next", VK_MEDIA_NEXT_TRACK}, {"media_prev", VK_MEDIA_PREV_TRACK}, {"volume_up", VK_VOLUME_UP}, {"volume_down", VK_VOLUME_DOWN}, {"volume_mute", VK_VOLUME_MUTE}, {"lwin", VK_LWIN}, {"rwin", VK_RWIN}, {"win", VK_LWIN}, {"windows", VK_LWIN}, {"super", VK_LWIN}, {"meta", VK_LWIN}, {"ctrl", VK_CONTROL}, {"control", VK_CONTROL}, {"lctrl", VK_LCONTROL}, {"rctrl", VK_RCONTROL}, {"alt", VK_MENU}, {"lalt", VK_LMENU}, {"ralt", VK_RMENU}, {"shift", VK_SHIFT}, {"lshift", VK_LSHIFT}, {"rshift", VK_RSHIFT}, {"mayus", VK_SHIFT}};
}

Napi::Value MoveMouseRelative(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2)
    {
        Napi::TypeError::New(env, "Se requieren 2 argumentos: dx, dy").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsNumber() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Los argumentos deben ser números").ThrowAsJavaScriptException();
        return env.Null();
    }

    int dx = info[0].As<Napi::Number>().Int32Value();
    int dy = info[1].As<Napi::Number>().Int32Value();

    INPUT input = {};
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;

    UINT result = SendInput(1, &input, sizeof(INPUT));
    if (result == 0)
    {
        Napi::Error::New(env, "Error al mover el mouse").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value GetMousePosition(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    POINT cursorPos;
    if (GetCursorPos(&cursorPos))
    {
        Napi::Object position = Napi::Object::New(env);
        position.Set("x", Napi::Number::New(env, cursorPos.x));
        position.Set("y", Napi::Number::New(env, cursorPos.y));
        return position;
    }
    return env.Null();
}

Napi::Value Click(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = info[0].As<Napi::String>().Utf8Value();
    }

    INPUT input[2] = {};
    input[0].type = INPUT_MOUSE;
    input[1].type = INPUT_MOUSE;

    if (button == "left")
    {
        input[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
        input[1].mi.dwFlags = MOUSEEVENTF_LEFTUP;
    }
    else if (button == "right")
    {
        input[0].mi.dwFlags = MOUSEEVENTF_RIGHTDOWN;
        input[1].mi.dwFlags = MOUSEEVENTF_RIGHTUP;
    }
    else if (button == "middle")
    {
        input[0].mi.dwFlags = MOUSEEVENTF_MIDDLEDOWN;
        input[1].mi.dwFlags = MOUSEEVENTF_MIDDLEUP;
    }
    else
    {
        Napi::TypeError::New(env, "Botón inválido. Use: left, right, middle").ThrowAsJavaScriptException();
        return env.Null();
    }

    SendInput(2, input, sizeof(INPUT));
    return Napi::Boolean::New(env, true);
}

Napi::Value DoubleClick(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    INPUT input[4] = {};
    input[0].type = INPUT_MOUSE;
    input[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    input[1].type = INPUT_MOUSE;
    input[1].mi.dwFlags = MOUSEEVENTF_LEFTUP;
    input[2].type = INPUT_MOUSE;
    input[2].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    input[3].type = INPUT_MOUSE;
    input[3].mi.dwFlags = MOUSEEVENTF_LEFTUP;

    SendInput(4, input, sizeof(INPUT));
    return Napi::Boolean::New(env, true);
}

Napi::Value Scroll(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber())
    {
        Napi::TypeError::New(env, "Se requiere un argumento numérico (delta)").ThrowAsJavaScriptException();
        return env.Null();
    }

    int delta = info[0].As<Napi::Number>().Int32Value();

    INPUT input = {};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_WHEEL;
    input.mi.mouseData = delta * WHEEL_DELTA / 120;

    SendInput(1, &input, sizeof(INPUT));
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseDown(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = info[0].As<Napi::String>().Utf8Value();
    }

    INPUT input = {};
    input.type = INPUT_MOUSE;

    if (button == "left")
    {
        input.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    }
    else if (button == "right")
    {
        input.mi.dwFlags = MOUSEEVENTF_RIGHTDOWN;
    }
    else if (button == "middle")
    {
        input.mi.dwFlags = MOUSEEVENTF_MIDDLEDOWN;
    }

    SendInput(1, &input, sizeof(INPUT));
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseUp(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = info[0].As<Napi::String>().Utf8Value();
    }

    INPUT input = {};
    input.type = INPUT_MOUSE;

    if (button == "left")
    {
        input.mi.dwFlags = MOUSEEVENTF_LEFTUP;
    }
    else if (button == "right")
    {
        input.mi.dwFlags = MOUSEEVENTF_RIGHTUP;
    }
    else if (button == "middle")
    {
        input.mi.dwFlags = MOUSEEVENTF_MIDDLEUP;
    }

    SendInput(1, &input, sizeof(INPUT));
    return Napi::Boolean::New(env, true);
}

Napi::Value TypeText(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::u16string text = info[0].As<Napi::String>().Utf16Value();
    for (size_t i = 0; i < text.size(); ++i)
    {
        wchar_t ch = static_cast<wchar_t>(text[i]);
        SendUnicodeCharacter(ch);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value KeyTap(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string key = info[0].As<Napi::String>().Utf8Value();
    std::transform(key.begin(), key.end(), key.begin(), ::tolower);

    auto it = SPECIAL_KEY_MAP.find(key);
    if (it == SPECIAL_KEY_MAP.end())
    {
        Napi::TypeError::New(env, "Tecla especial desconocida").ThrowAsJavaScriptException();
        return env.Null();
    }

    SendVirtualKeyPress(it->second, NeedsExtendedKeyName(key));
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyDown(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string key = info[0].As<Napi::String>().Utf8Value();
    std::transform(key.begin(), key.end(), key.begin(), ::tolower);

    auto it = SPECIAL_KEY_MAP.find(key);
    if (it != SPECIAL_KEY_MAP.end())
    {
        SendVirtualKeyEvent(it->second, true, NeedsExtendedKeyName(key));
        return Napi::Boolean::New(env, true);
    }

    std::wstring wide = Utf8ToWide(key);
    if (wide.length() == 1)
    {
        wchar_t ch = wide[0];
        INPUT input = {};
        input.type = INPUT_KEYBOARD;
        input.ki.dwFlags = KEYEVENTF_UNICODE;
        input.ki.wScan = ch;
        SendInput(1, &input, sizeof(INPUT));
        return Napi::Boolean::New(env, true);
    }

    Napi::TypeError::New(env, "Tecla desconocida para keyDown").ThrowAsJavaScriptException();
    return env.Null();
}

Napi::Value KeyUp(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string key = info[0].As<Napi::String>().Utf8Value();
    std::transform(key.begin(), key.end(), key.begin(), ::tolower);

    auto it = SPECIAL_KEY_MAP.find(key);
    if (it != SPECIAL_KEY_MAP.end())
    {
        SendVirtualKeyEvent(it->second, false, NeedsExtendedKeyName(key));
        return Napi::Boolean::New(env, true);
    }

    std::wstring wide = Utf8ToWide(key);
    if (wide.length() == 1)
    {
        wchar_t ch = wide[0];
        INPUT input = {};
        input.type = INPUT_KEYBOARD;
        input.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        input.ki.wScan = ch;
        SendInput(1, &input, sizeof(INPUT));
        return Napi::Boolean::New(env, true);
    }

    Napi::TypeError::New(env, "Tecla desconocida para keyUp").ThrowAsJavaScriptException();
    return env.Null();
}

Napi::Value KeyCombo(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Se requiere un arreglo de teclas").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array arr = info[0].As<Napi::Array>();
    if (arr.Length() == 0)
    {
        return Napi::Boolean::New(env, true);
    }

    struct ComboEntry
    {
        bool isUnicode;
        WORD vk;
        wchar_t unicode;
    };

    std::vector<WORD> modifiers;
    std::vector<ComboEntry> entries;

    auto addModifier = [&modifiers](WORD vk)
    {
        if (std::find(modifiers.begin(), modifiers.end(), vk) == modifiers.end())
        {
            modifiers.push_back(vk);
        }
    };

    for (uint32_t i = 0; i < arr.Length(); ++i)
    {
        Napi::Value value = arr[i];
        if (!value.IsString())
        {
            continue;
        }

        std::string key = value.As<Napi::String>().Utf8Value();
        std::transform(key.begin(), key.end(), key.begin(), ::tolower);

        auto it = SPECIAL_KEY_MAP.find(key);
        if (it != SPECIAL_KEY_MAP.end())
        {
            WORD vk = it->second;
            if (IsModifierKey(vk))
            {
                addModifier(vk);
            }
            else
            {
                entries.push_back({false, vk, 0});
            }
            continue;
        }

        std::wstring wide = Utf8ToWide(key);
        if (wide.length() != 1)
        {
            continue;
        }

        wchar_t ch = wide[0];
        short vkScan = VkKeyScanW(ch);
        if (vkScan == -1)
        {
            entries.push_back({true, 0, ch});
            continue;
        }

        WORD vk = LOBYTE(vkScan);
        short modifiersMask = HIBYTE(vkScan);

        if (modifiersMask & 1)
        {
            addModifier(VK_SHIFT);
        }
        if (modifiersMask & 2)
        {
            addModifier(VK_CONTROL);
        }
        if (modifiersMask & 4)
        {
            addModifier(VK_MENU);
        }

        if (IsModifierKey(vk))
        {
            addModifier(vk);
        }
        else
        {
            entries.push_back({false, vk, 0});
        }
    }

    if (entries.empty() && modifiers.empty())
    {
        return Napi::Boolean::New(env, true);
    }

    for (WORD modifier : modifiers)
    {
        SendVirtualKeyEvent(modifier, true);
    }

    for (const auto &entry : entries)
    {
        if (entry.isUnicode)
        {
            SendUnicodeCharacter(entry.unicode);
        }
        else
        {
            SendVirtualKeyEvent(entry.vk, true);
            SendVirtualKeyEvent(entry.vk, false);
        }
    }

    for (auto itMod = modifiers.rbegin(); itMod != modifiers.rend(); ++itMod)
    {
        SendVirtualKeyEvent(*itMod, false);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports)
{
    exports.Set("moveRelative", Napi::Function::New(env, MoveMouseRelative));
    exports.Set("getPosition", Napi::Function::New(env, GetMousePosition));
    exports.Set("click", Napi::Function::New(env, Click));
    exports.Set("doubleClick", Napi::Function::New(env, DoubleClick));
    exports.Set("scroll", Napi::Function::New(env, Scroll));
    exports.Set("mouseDown", Napi::Function::New(env, MouseDown));
    exports.Set("mouseUp", Napi::Function::New(env, MouseUp));
    exports.Set("typeText", Napi::Function::New(env, TypeText));
    exports.Set("keyTap", Napi::Function::New(env, KeyTap));
    exports.Set("keyDown", Napi::Function::New(env, KeyDown));
    exports.Set("keyUp", Napi::Function::New(env, KeyUp));
    exports.Set("keyCombo", Napi::Function::New(env, KeyCombo));
    return exports;
}

NODE_API_MODULE(mouse_controller, InitModule)

#else // __linux__

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/extensions/XTest.h>
#include <X11/keysym.h>
#include <X11/XKBlib.h>
#include <X11/XF86keysym.h>

#include <linux/input-event-codes.h>
#include <linux/uinput.h>

#include <cctype>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <optional>
#include <string>
#include <sys/ioctl.h>
#include <thread>
#include <unordered_map>
#include <vector>
#include <unistd.h>

namespace
{
    bool IsWaylandSession()
    {
        const char *sessionType = std::getenv("XDG_SESSION_TYPE");
        if (sessionType && std::strcmp(sessionType, "wayland") == 0)
        {
            return true;
        }
        const char *waylandDisplay = std::getenv("WAYLAND_DISPLAY");
        return waylandDisplay && *waylandDisplay;
    }

    Display *GetDisplay()
    {
        if (IsWaylandSession())
        {
            // En Wayland XTest solo alcanza a clientes XWayland.
            return nullptr;
        }
        static Display *display = []() -> Display *
        {
            XInitThreads();
            return XOpenDisplay(nullptr);
        }();
        return display;
    }

    bool EnsureDisplay(const Napi::Env &env)
    {
        if (!GetDisplay())
        {
            Napi::Error::New(env, "No se pudo abrir la pantalla X11").ThrowAsJavaScriptException();
            return false;
        }
        return true;
    }

    std::string Normalize(const std::string &value)
    {
        std::string lower = value;
        std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c)
                       { return static_cast<char>(std::tolower(c)); });
        return lower;
    }

    // =====================================================================
    // Backend uinput
    //
    // Inyecta eventos a nivel de kernel creando un dispositivo virtual, por lo
    // que funciona igual en X11 y en Wayland (Hyprland, Sway, KDE Plasma,
    // GNOME, COSMIC). Requiere permiso de escritura sobre /dev/uinput.
    // =====================================================================
    struct UinputBackend
    {
        int fd = -1;
        bool attempted = false;
        bool ready = false;
        std::string error;
        int posX = 0;
        int posY = 0;
    };

    UinputBackend &Uinput()
    {
        static UinputBackend backend;
        return backend;
    }

    const std::unordered_map<std::string, int> &UinputKeyMap()
    {
        static const std::unordered_map<std::string, int> map = {
            {"esc", KEY_ESC}, {"escape", KEY_ESC},
            {"backspace", KEY_BACKSPACE}, {"tab", KEY_TAB},
            {"enter", KEY_ENTER}, {"return", KEY_ENTER},
            {"space", KEY_SPACE}, {"delete", KEY_DELETE}, {"del", KEY_DELETE},
            {"insert", KEY_INSERT}, {"home", KEY_HOME}, {"end", KEY_END},
            {"pageup", KEY_PAGEUP}, {"pagedown", KEY_PAGEDOWN},
            {"up", KEY_UP}, {"down", KEY_DOWN}, {"left", KEY_LEFT}, {"right", KEY_RIGHT},
            {"capslock", KEY_CAPSLOCK}, {"numlock", KEY_NUMLOCK}, {"scrolllock", KEY_SCROLLLOCK},
            {"printscreen", KEY_SYSRQ}, {"pause", KEY_PAUSE}, {"pausebreak", KEY_PAUSE},
            {"numpad0", KEY_KP0}, {"numpad1", KEY_KP1}, {"numpad2", KEY_KP2},
            {"numpad3", KEY_KP3}, {"numpad4", KEY_KP4}, {"numpad5", KEY_KP5},
            {"numpad6", KEY_KP6}, {"numpad7", KEY_KP7}, {"numpad8", KEY_KP8},
            {"numpad9", KEY_KP9}, {"numpadadd", KEY_KPPLUS}, {"numpadsubtract", KEY_KPMINUS},
            {"numpadmultiply", KEY_KPASTERISK}, {"numpaddivide", KEY_KPSLASH},
            {"numpaddecimal", KEY_KPDOT}, {"numpadenter", KEY_KPENTER},
            {"f1", KEY_F1}, {"f2", KEY_F2}, {"f3", KEY_F3}, {"f4", KEY_F4},
            {"f5", KEY_F5}, {"f6", KEY_F6}, {"f7", KEY_F7}, {"f8", KEY_F8},
            {"f9", KEY_F9}, {"f10", KEY_F10}, {"f11", KEY_F11}, {"f12", KEY_F12},
            {"media_play", KEY_PLAYPAUSE}, {"media_stop", KEY_STOPCD},
            {"media_next", KEY_NEXTSONG}, {"media_prev", KEY_PREVIOUSSONG},
            {"volume_up", KEY_VOLUMEUP}, {"volume_down", KEY_VOLUMEDOWN},
            {"volume_mute", KEY_MUTE},
            {"lwin", KEY_LEFTMETA}, {"rwin", KEY_RIGHTMETA}, {"win", KEY_LEFTMETA},
            {"windows", KEY_LEFTMETA}, {"super", KEY_LEFTMETA}, {"meta", KEY_LEFTMETA},
            {"ctrl", KEY_LEFTCTRL}, {"control", KEY_LEFTCTRL}, {"lctrl", KEY_LEFTCTRL},
            {"rctrl", KEY_RIGHTCTRL},
            {"alt", KEY_LEFTALT}, {"lalt", KEY_LEFTALT}, {"ralt", KEY_RIGHTALT},
            {"shift", KEY_LEFTSHIFT}, {"lshift", KEY_LEFTSHIFT}, {"rshift", KEY_RIGHTSHIFT},
            {"mayus", KEY_LEFTSHIFT},
            {"minus", KEY_MINUS}, {"equal", KEY_EQUAL},
            {"leftbrace", KEY_LEFTBRACE}, {"rightbrace", KEY_RIGHTBRACE},
            {"semicolon", KEY_SEMICOLON}, {"apostrophe", KEY_APOSTROPHE},
            {"grave", KEY_GRAVE}, {"comma", KEY_COMMA}, {"dot", KEY_DOT},
            {"slash", KEY_SLASH}, {"backslash", KEY_BACKSLASH}};
        return map;
    }

    std::optional<int> ResolveUinputKey(const std::string &key)
    {
        const std::string normalized = Normalize(key);
        if (normalized.empty())
        {
            return std::nullopt;
        }
        auto it = UinputKeyMap().find(normalized);
        if (it != UinputKeyMap().end())
        {
            return it->second;
        }
        if (normalized.size() == 1)
        {
            const char c = normalized[0];
            if (c >= 'a' && c <= 'z')
            {
                return KEY_A + (c - 'a');
            }
            if (c >= '0' && c <= '9')
            {
                return c == '0' ? KEY_0 : KEY_1 + (c - '1');
            }
        }
        return std::nullopt;
    }

    bool IsUinputModifier(int code)
    {
        switch (code)
        {
        case KEY_LEFTSHIFT:
        case KEY_RIGHTSHIFT:
        case KEY_LEFTCTRL:
        case KEY_RIGHTCTRL:
        case KEY_LEFTALT:
        case KEY_RIGHTALT:
        case KEY_LEFTMETA:
        case KEY_RIGHTMETA:
            return true;
        default:
            return false;
        }
    }

    bool WriteUinput(int type, int code, int value)
    {
        UinputBackend &backend = Uinput();
        if (backend.fd < 0)
        {
            return false;
        }
        struct input_event event;
        std::memset(&event, 0, sizeof(event));
        event.type = static_cast<__u16>(type);
        event.code = static_cast<__u16>(code);
        event.value = value;
        const ssize_t written = ::write(backend.fd, &event, sizeof(event));
        if (written != static_cast<ssize_t>(sizeof(event)))
        {
            // El dispositivo puede desaparecer tras suspender/hibernar.
            // Se cierra el descriptor para poder recrearlo en el siguiente uso.
            ::close(backend.fd);
            backend.fd = -1;
            backend.ready = false;
            backend.attempted = false;
            backend.error.clear();
            return false;
        }
        return true;
    }

    bool SyncUinput()
    {
        return WriteUinput(EV_SYN, SYN_REPORT, 0);
    }

    bool CreateUinputDevice(int fd)
    {
        if (ioctl(fd, UI_SET_EVBIT, EV_KEY) < 0 ||
            ioctl(fd, UI_SET_EVBIT, EV_REL) < 0)
        {
            return false;
        }

        std::vector<int> keys;
        keys.reserve(UinputKeyMap().size() + 64);
        for (const auto &entry : UinputKeyMap())
        {
            keys.push_back(entry.second);
        }
        for (int code = KEY_A; code <= KEY_Z; ++code)
        {
            keys.push_back(code);
        }
        for (int code = KEY_1; code <= KEY_0; ++code)
        {
            keys.push_back(code);
        }
        keys.push_back(BTN_LEFT);
        keys.push_back(BTN_RIGHT);
        keys.push_back(BTN_MIDDLE);

        for (int code : keys)
        {
            if (ioctl(fd, UI_SET_KEYBIT, code) < 0)
            {
                return false;
            }
        }

        ioctl(fd, UI_SET_RELBIT, REL_X);
        ioctl(fd, UI_SET_RELBIT, REL_Y);
        ioctl(fd, UI_SET_RELBIT, REL_WHEEL);
        ioctl(fd, UI_SET_RELBIT, REL_HWHEEL);

        struct uinput_setup setup;
        std::memset(&setup, 0, sizeof(setup));
        setup.id.bustype = BUS_USB;
        setup.id.vendor = 0x1209; // pid.codes
        setup.id.product = 0x0001;
        setup.id.version = 1;
        std::strncpy(setup.name, "Remote Controllers Virtual Input", UINPUT_MAX_NAME_SIZE - 1);
        setup.ff_effects_max = 0;

        if (ioctl(fd, UI_DEV_SETUP, &setup) < 0)
        {
            return false;
        }
        if (ioctl(fd, UI_DEV_CREATE) < 0)
        {
            return false;
        }

        // El compositor necesita un instante para enumerar el dispositivo; si
        // se escribe de inmediato se pueden perder los primeros eventos.
        std::this_thread::sleep_for(std::chrono::milliseconds(120));
        return true;
    }

    bool EnsureUinput()
    {
        UinputBackend &backend = Uinput();
        if (backend.ready)
        {
            return true;
        }
        if (backend.attempted && !backend.error.empty())
        {
            return false;
        }
        backend.attempted = true;

        int fd = ::open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
        if (fd < 0)
        {
            fd = ::open("/dev/input/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
        }
        if (fd < 0)
        {
            backend.error = std::string("No se pudo abrir /dev/uinput: ") + std::strerror(errno);
            return false;
        }

        if (!CreateUinputDevice(fd))
        {
            backend.error = std::string("No se pudo crear el dispositivo uinput: ") + std::strerror(errno);
            ::close(fd);
            return false;
        }

        backend.fd = fd;
        backend.ready = true;
        backend.error.clear();
        return true;
    }

    void DestroyUinput()
    {
        UinputBackend &backend = Uinput();
        if (backend.fd >= 0)
        {
            ioctl(backend.fd, UI_DEV_DESTROY);
            ::close(backend.fd);
        }
        backend.fd = -1;
        backend.ready = false;
        backend.attempted = false;
    }

    // Decide el backend activo: uinput en Wayland (XTest no llega a clientes
    // nativos) y XTest en X11. Si no hay pantalla X, se usa uinput.
    bool UseUinput()
    {
        if (Uinput().ready)
        {
            return true;
        }
        if (IsWaylandSession())
        {
            return EnsureUinput();
        }
        if (GetDisplay())
        {
            return false;
        }
        return EnsureUinput();
    }

    bool EmitPointerMotion(int dx, int dy)
    {
        UinputBackend &backend = Uinput();
        const bool ok = WriteUinput(EV_REL, REL_X, dx) &&
                        WriteUinput(EV_REL, REL_Y, dy) &&
                        SyncUinput();
        if (ok)
        {
            backend.posX += dx;
            backend.posY += dy;
        }
        return ok;
    }

    bool EmitButton(int button, bool down)
    {
        return WriteUinput(EV_KEY, button, down ? 1 : 0) && SyncUinput();
    }

    bool TapButton(int button)
    {
        return EmitButton(button, true) && EmitButton(button, false);
    }

    bool EmitScroll(int steps)
    {
        if (steps == 0)
        {
            return true;
        }
        return WriteUinput(EV_REL, REL_WHEEL, steps) && SyncUinput();
    }

    bool EmitKey(int code, bool down)
    {
        return WriteUinput(EV_KEY, code, down ? 1 : 0) && SyncUinput();
    }

    bool TapKey(int code)
    {
        return EmitKey(code, true) && EmitKey(code, false);
    }

    struct UinputChar
    {
        int code;
        bool shift;
    };

    std::optional<UinputChar> ResolveUinputChar(char32_t ch)
    {
        if (ch >= U'a' && ch <= U'z')
        {
            return UinputChar{KEY_A + static_cast<int>(ch - U'a'), false};
        }
        if (ch >= U'A' && ch <= U'Z')
        {
            return UinputChar{KEY_A + static_cast<int>(ch - U'A'), true};
        }
        if (ch >= U'0' && ch <= U'9')
        {
            return UinputChar{ch == U'0' ? KEY_0 : KEY_1 + static_cast<int>(ch - U'1'), false};
        }

        switch (ch)
        {
        case U' ':
            return UinputChar{KEY_SPACE, false};
        case U'\n':
        case U'\r':
            return UinputChar{KEY_ENTER, false};
        case U'\t':
            return UinputChar{KEY_TAB, false};
        case U'-':
            return UinputChar{KEY_MINUS, false};
        case U'_':
            return UinputChar{KEY_MINUS, true};
        case U'=':
            return UinputChar{KEY_EQUAL, false};
        case U'+':
            return UinputChar{KEY_EQUAL, true};
        case U'[':
            return UinputChar{KEY_LEFTBRACE, false};
        case U'{':
            return UinputChar{KEY_LEFTBRACE, true};
        case U']':
            return UinputChar{KEY_RIGHTBRACE, false};
        case U'}':
            return UinputChar{KEY_RIGHTBRACE, true};
        case U';':
            return UinputChar{KEY_SEMICOLON, false};
        case U':':
            return UinputChar{KEY_SEMICOLON, true};
        case U'\'':
            return UinputChar{KEY_APOSTROPHE, false};
        case U'"':
            return UinputChar{KEY_APOSTROPHE, true};
        case U'`':
            return UinputChar{KEY_GRAVE, false};
        case U'~':
            return UinputChar{KEY_GRAVE, true};
        case U',':
            return UinputChar{KEY_COMMA, false};
        case U'<':
            return UinputChar{KEY_COMMA, true};
        case U'.':
            return UinputChar{KEY_DOT, false};
        case U'>':
            return UinputChar{KEY_DOT, true};
        case U'/':
            return UinputChar{KEY_SLASH, false};
        case U'?':
            return UinputChar{KEY_SLASH, true};
        case U'\\':
            return UinputChar{KEY_BACKSLASH, false};
        case U'|':
            return UinputChar{KEY_BACKSLASH, true};
        case U'!':
            return UinputChar{KEY_1, true};
        case U'@':
            return UinputChar{KEY_2, true};
        case U'#':
            return UinputChar{KEY_3, true};
        case U'$':
            return UinputChar{KEY_4, true};
        case U'%':
            return UinputChar{KEY_5, true};
        case U'^':
            return UinputChar{KEY_6, true};
        case U'&':
            return UinputChar{KEY_7, true};
        case U'*':
            return UinputChar{KEY_8, true};
        case U'(':
            return UinputChar{KEY_9, true};
        case U')':
            return UinputChar{KEY_0, true};
        default:
            return std::nullopt;
        }
    }

    void TypeUinputChar(char32_t ch)
    {
        auto mapping = ResolveUinputChar(ch);
        if (!mapping)
        {
            return;
        }
        if (mapping->shift)
        {
            EmitKey(KEY_LEFTSHIFT, true);
        }
        TapKey(mapping->code);
        if (mapping->shift)
        {
            EmitKey(KEY_LEFTSHIFT, false);
        }
    }

    std::optional<KeyCode> FallbackKeycodeForKeysym(KeySym keysym)
    {
        static const std::unordered_map<KeySym, KeyCode> FALLBACK_KP_KEYCODES = {
            {XK_KP_0, 90}, {XK_KP_1, 87}, {XK_KP_2, 88}, {XK_KP_3, 89},
            {XK_KP_4, 83}, {XK_KP_5, 84}, {XK_KP_6, 85}, {XK_KP_7, 79},
            {XK_KP_8, 80}, {XK_KP_9, 81}, {XK_KP_Add, 86}, {XK_KP_Subtract, 82},
            {XK_KP_Multiply, 63}, {XK_KP_Divide, 106}, {XK_KP_Decimal, 91},
            {XK_KP_Enter, 108}};

        auto it = FALLBACK_KP_KEYCODES.find(keysym);
        if (it == FALLBACK_KP_KEYCODES.end())
        {
            return std::nullopt;
        }
        return it->second;
    }

    bool SendKeySym(KeySym keysym, bool keyDown)
    {
        Display *display = GetDisplay();
        if (!display)
        {
            return false;
        }

        KeyCode keycode = XKeysymToKeycode(display, keysym);
        if (keycode == 0)
        {
            int minKeycode = 0;
            int maxKeycode = 0;
            XDisplayKeycodes(display, &minKeycode, &maxKeycode);
            for (int kc = minKeycode; kc <= maxKeycode; ++kc)
            {
                for (int group = 0; group < 4; ++group)
                {
                    KeySym mapped = XkbKeycodeToKeysym(display, static_cast<KeyCode>(kc), group, 0);
                    if (mapped == keysym)
                    {
                        keycode = static_cast<KeyCode>(kc);
                        break;
                    }
                }
                if (keycode != 0)
                {
                    break;
                }
            }
        }

        if (keycode == 0)
        {
            auto fallback = FallbackKeycodeForKeysym(keysym);
            if (!fallback)
            {
                return false;
            }
            keycode = *fallback;
        }

        XTestFakeKeyEvent(display, keycode, keyDown ? True : False, CurrentTime);
        XFlush(display);
        return true;
    }

    void SendKeySymPress(KeySym keysym)
    {
        SendKeySym(keysym, true);
        SendKeySym(keysym, false);
    }

    void SendButton(unsigned int button, bool down)
    {
        Display *display = GetDisplay();
        if (!display)
        {
            return;
        }
        XTestFakeButtonEvent(display, button, down ? True : False, CurrentTime);
        XFlush(display);
    }

    const std::unordered_map<std::string, KeySym> SPECIAL_KEY_MAP = {
        {"backspace", XK_BackSpace}, {"enter", XK_Return}, {"return", XK_Return}, {"space", XK_space}, {"tab", XK_Tab}, {"esc", XK_Escape}, {"escape", XK_Escape}, {"delete", XK_Delete}, {"del", XK_Delete}, {"insert", XK_Insert}, {"home", XK_Home}, {"end", XK_End}, {"pageup", XK_Prior}, {"pagedown", XK_Next}, {"up", XK_Up}, {"down", XK_Down}, {"left", XK_Left}, {"right", XK_Right}, {"capslock", XK_Caps_Lock}, {"numlock", XK_Num_Lock}, {"scrolllock", XK_Scroll_Lock}, {"numpad0", XK_KP_0}, {"numpad1", XK_KP_1}, {"numpad2", XK_KP_2}, {"numpad3", XK_KP_3}, {"numpad4", XK_KP_4}, {"numpad5", XK_KP_5}, {"numpad6", XK_KP_6}, {"numpad7", XK_KP_7}, {"numpad8", XK_KP_8}, {"numpad9", XK_KP_9}, {"numpadadd", XK_KP_Add}, {"numpadsubtract", XK_KP_Subtract}, {"numpadmultiply", XK_KP_Multiply}, {"numpaddivide", XK_KP_Divide}, {"numpaddecimal", XK_KP_Decimal}, {"numpadenter", XK_KP_Enter}, {"printscreen", XK_Print}, {"pause", XK_Pause}, {"pausebreak", XK_Pause}, {"f1", XK_F1}, {"f2", XK_F2}, {"f3", XK_F3}, {"f4", XK_F4}, {"f5", XK_F5}, {"f6", XK_F6}, {"f7", XK_F7}, {"f8", XK_F8}, {"f9", XK_F9}, {"f10", XK_F10}, {"f11", XK_F11}, {"f12", XK_F12}, {"media_play", XF86XK_AudioPlay}, {"media_stop", XF86XK_AudioStop}, {"media_next", XF86XK_AudioNext}, {"media_prev", XF86XK_AudioPrev}, {"volume_up", XF86XK_AudioRaiseVolume}, {"volume_down", XF86XK_AudioLowerVolume}, {"volume_mute", XF86XK_AudioMute}, {"lwin", XK_Super_L}, {"rwin", XK_Super_R}, {"win", XK_Super_L}, {"windows", XK_Super_L}, {"super", XK_Super_L}, {"meta", XK_Super_L}, {"ctrl", XK_Control_L}, {"control", XK_Control_L}, {"lctrl", XK_Control_L}, {"rctrl", XK_Control_R}, {"alt", XK_Alt_L}, {"lalt", XK_Alt_L}, {"ralt", XK_Alt_R}, {"shift", XK_Shift_L}, {"lshift", XK_Shift_L}, {"rshift", XK_Shift_R}, {"mayus", XK_Shift_L}};

    bool IsModifier(KeySym keysym)
    {
        switch (keysym)
        {
        case XK_Shift_L:
        case XK_Shift_R:
        case XK_Control_L:
        case XK_Control_R:
        case XK_Alt_L:
        case XK_Alt_R:
        case XK_Super_L:
        case XK_Super_R:
            return true;
        default:
            return false;
        }
    }

    struct CharMapping
    {
        KeySym keysym;
        bool needsShift;
    };

    std::optional<CharMapping> LookupChar(char32_t ch)
    {
        if (ch >= U'a' && ch <= U'z')
        {
            return CharMapping{static_cast<KeySym>(XK_a + (ch - U'a')), false};
        }
        if (ch >= U'A' && ch <= U'Z')
        {
            return CharMapping{static_cast<KeySym>(XK_a + (ch - U'A')), true};
        }
        if (ch >= U'0' && ch <= U'9')
        {
            return CharMapping{static_cast<KeySym>(XK_0 + (ch - U'0')), false};
        }

        switch (ch)
        {
        case U' ':
            return CharMapping{XK_space, false};
        case U'\n':
        case U'\r':
            return CharMapping{XK_Return, false};
        case U'\t':
            return CharMapping{XK_Tab, false};
        case U'-':
            return CharMapping{XK_minus, false};
        case U'_':
            return CharMapping{XK_minus, true};
        case U'=':
            return CharMapping{XK_equal, false};
        case U'+':
            return CharMapping{XK_equal, true};
        case U'[':
            return CharMapping{XK_bracketleft, false};
        case U'{':
            return CharMapping{XK_bracketleft, true};
        case U']':
            return CharMapping{XK_bracketright, false};
        case U'}':
            return CharMapping{XK_bracketright, true};
        case U';':
            return CharMapping{XK_semicolon, false};
        case U':':
            return CharMapping{XK_semicolon, true};
        case U'\'':
            return CharMapping{XK_apostrophe, false};
        case U'"':
            return CharMapping{XK_apostrophe, true};
        case U'`':
            return CharMapping{XK_grave, false};
        case U'~':
            return CharMapping{XK_grave, true};
        case U',':
            return CharMapping{XK_comma, false};
        case U'<':
            return CharMapping{XK_comma, true};
        case U'.':
            return CharMapping{XK_period, false};
        case U'>':
            return CharMapping{XK_period, true};
        case U'/':
            return CharMapping{XK_slash, false};
        case U'?':
            return CharMapping{XK_slash, true};
        case U'\\':
            return CharMapping{XK_backslash, false};
        case U'|':
            return CharMapping{XK_backslash, true};
        case U'!':
            return CharMapping{XK_1, true};
        case U'@':
            return CharMapping{XK_2, true};
        case U'#':
            return CharMapping{XK_3, true};
        case U'$':
            return CharMapping{XK_4, true};
        case U'%':
            return CharMapping{XK_5, true};
        case U'^':
            return CharMapping{XK_6, true};
        case U'&':
            return CharMapping{XK_7, true};
        case U'*':
            return CharMapping{XK_8, true};
        case U'(':
            return CharMapping{XK_9, true};
        case U')':
            return CharMapping{XK_0, true};
        default:
            return std::nullopt;
        }
    }

    std::vector<char32_t> ToCodepoints(const std::u16string &text)
    {
        std::vector<char32_t> codepoints;
        for (size_t i = 0; i < text.size(); ++i)
        {
            char16_t ch = text[i];
            if (ch >= 0xD800 && ch <= 0xDBFF && i + 1 < text.size())
            {
                char16_t low = text[i + 1];
                if (low >= 0xDC00 && low <= 0xDFFF)
                {
                    char32_t cp = ((static_cast<char32_t>(ch - 0xD800) << 10) | (low - 0xDC00)) + 0x10000;
                    codepoints.push_back(cp);
                    ++i;
                    continue;
                }
            }
            codepoints.push_back(ch);
        }
        return codepoints;
    }

    void SendCharacterChar32(char32_t cp)
    {
        auto mapping = LookupChar(cp);
        if (!mapping)
        {
            return;
        }

        if (mapping->needsShift)
        {
            SendKeySym(XK_Shift_L, true);
        }
        SendKeySymPress(mapping->keysym);
        if (mapping->needsShift)
        {
            SendKeySym(XK_Shift_L, false);
        }
    }
}

Napi::Value MoveMouseRelative(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 2)
    {
        Napi::TypeError::New(env, "Se requieren 2 argumentos: dx, dy").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsNumber() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Los argumentos deben ser números").ThrowAsJavaScriptException();
        return env.Null();
    }

    int dx = info[0].As<Napi::Number>().Int32Value();
    int dy = info[1].As<Napi::Number>().Int32Value();

    if (UseUinput())
    {
        if (!EmitPointerMotion(dx, dy))
        {
            Napi::Error::New(env, "uinput no pudo mover el puntero (permisos de /dev/uinput)").ThrowAsJavaScriptException();
            return env.Null();
        }
        return Napi::Boolean::New(env, true);
    }

    if (!EnsureDisplay(env))
    {
        return env.Null();
    }

    XTestFakeRelativeMotionEvent(GetDisplay(), dx, dy, CurrentTime);
    XFlush(GetDisplay());
    return Napi::Boolean::New(env, true);
}

Napi::Value GetMousePosition(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (UseUinput())
    {
        Napi::Object tracked = Napi::Object::New(env);
        tracked.Set("x", Napi::Number::New(env, Uinput().posX));
        tracked.Set("y", Napi::Number::New(env, Uinput().posY));
        return tracked;
    }

    if (!EnsureDisplay(env))
    {
        return env.Null();
    }

    Window root = DefaultRootWindow(GetDisplay());
    Window child;
    int rootX = 0, rootY = 0;
    int winX = 0, winY = 0;
    unsigned int mask = 0;

    if (XQueryPointer(GetDisplay(), root, &root, &child, &rootX, &rootY, &winX, &winY, &mask))
    {
        Napi::Object position = Napi::Object::New(env);
        position.Set("x", Napi::Number::New(env, rootX));
        position.Set("y", Napi::Number::New(env, rootY));
        return position;
    }
    return env.Null();
}

Napi::Value Click(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = Normalize(info[0].As<Napi::String>().Utf8Value());
    }

    unsigned int btn = 1;
    if (button == "left")
    {
        btn = 1;
    }
    else if (button == "right")
    {
        btn = 3;
    }
    else if (button == "middle")
    {
        btn = 2;
    }
    else
    {
        Napi::TypeError::New(env, "Botón inválido. Use: left, right, middle").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (UseUinput())
    {
        const int uinputButton = btn == 3 ? BTN_RIGHT : (btn == 2 ? BTN_MIDDLE : BTN_LEFT);
        if (!TapButton(uinputButton))
        {
            Napi::Error::New(env, "uinput no pudo enviar el clic").ThrowAsJavaScriptException();
            return env.Null();
        }
        return Napi::Boolean::New(env, true);
    }

    SendButton(btn, true);
    SendButton(btn, false);
    return Napi::Boolean::New(env, true);
}

Napi::Value DoubleClick(const Napi::CallbackInfo &info)
{
    Click(info);
    Click(info);
    return Napi::Boolean::New(info.Env(), true);
}

Napi::Value Scroll(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber())
    {
        Napi::TypeError::New(env, "Se requiere un argumento numérico (delta)").ThrowAsJavaScriptException();
        return env.Null();
    }

    int delta = info[0].As<Napi::Number>().Int32Value();
    int steps = std::clamp(delta, -120, 120) / 40;
    if (steps == 0)
    {
        steps = (delta > 0) ? 1 : (delta < 0 ? -1 : 0);
    }

    if (steps == 0)
    {
        return Napi::Boolean::New(env, true);
    }

    if (UseUinput())
    {
        if (!EmitScroll(steps))
        {
            Napi::Error::New(env, "uinput no pudo enviar el scroll").ThrowAsJavaScriptException();
            return env.Null();
        }
        return Napi::Boolean::New(env, true);
    }

    unsigned int button = steps > 0 ? 4 : 5;
    for (int i = 0; i < std::abs(steps); ++i)
    {
        SendButton(button, true);
        SendButton(button, false);
    }
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseDown(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = Normalize(info[0].As<Napi::String>().Utf8Value());
    }
    unsigned int btn = button == "right" ? 3 : button == "middle" ? 2
                                                                  : 1;
    if (UseUinput())
    {
        const int uinputButton = btn == 3 ? BTN_RIGHT : (btn == 2 ? BTN_MIDDLE : BTN_LEFT);
        EmitButton(uinputButton, true);
        return Napi::Boolean::New(env, true);
    }
    SendButton(btn, true);
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseUp(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString())
    {
        button = Normalize(info[0].As<Napi::String>().Utf8Value());
    }
    unsigned int btn = button == "right" ? 3 : button == "middle" ? 2
                                                                  : 1;
    if (UseUinput())
    {
        const int uinputButton = btn == 3 ? BTN_RIGHT : (btn == 2 ? BTN_MIDDLE : BTN_LEFT);
        EmitButton(uinputButton, false);
        return Napi::Boolean::New(env, true);
    }
    SendButton(btn, false);
    return Napi::Boolean::New(env, true);
}

KeySym ResolveKeySym(const std::string &key)
{
    auto it = SPECIAL_KEY_MAP.find(key);
    if (it != SPECIAL_KEY_MAP.end())
    {
        return it->second;
    }
    if (key.size() == 1)
    {
        char ch = key[0];
        if (ch >= 'a' && ch <= 'z')
        {
            return XK_a + (ch - 'a');
        }
        if (ch >= '0' && ch <= '9')
        {
            return XK_0 + (ch - '0');
        }
    }
    return NoSymbol;
}

void HandleKeyEvent(const std::string &key, bool keyDown)
{
    KeySym keysym = ResolveKeySym(key);
    if (keysym != NoSymbol)
    {
        SendKeySym(keysym, keyDown);
    }
    else if (key.size() == 1)
    {
        auto mapping = LookupChar(static_cast<unsigned char>(key[0]));
        if (mapping)
        {
            if (keyDown)
            {
                if (mapping->needsShift)
                {
                    SendKeySym(XK_Shift_L, true);
                }
                SendKeySym(mapping->keysym, true);
            }
            else
            {
                SendKeySym(mapping->keysym, false);
                if (mapping->needsShift)
                {
                    SendKeySym(XK_Shift_L, false);
                }
            }
        }
    }
}

Napi::Value KeyTap(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string key = Normalize(info[0].As<Napi::String>().Utf8Value());

    if (UseUinput())
    {
        auto code = ResolveUinputKey(key);
        if (!code)
        {
            Napi::TypeError::New(env, "Tecla especial desconocida").ThrowAsJavaScriptException();
            return env.Null();
        }
        if (!TapKey(*code))
        {
            Napi::Error::New(env, "uinput no pudo enviar la tecla").ThrowAsJavaScriptException();
            return env.Null();
        }
        return Napi::Boolean::New(env, true);
    }

    KeySym keysym = ResolveKeySym(key);
    if (keysym == NoSymbol)
    {
        Napi::TypeError::New(env, "Tecla especial desconocida").ThrowAsJavaScriptException();
        return env.Null();
    }

    SendKeySymPress(keysym);
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyDown(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }
    std::string key = Normalize(info[0].As<Napi::String>().Utf8Value());

    if (UseUinput())
    {
        auto code = ResolveUinputKey(key);
        if (!code)
        {
            auto mapping = key.size() == 1 ? ResolveUinputChar(static_cast<unsigned char>(key[0])) : std::nullopt;
            if (!mapping)
            {
                Napi::TypeError::New(env, "Tecla especial desconocida").ThrowAsJavaScriptException();
                return env.Null();
            }
            if (mapping->shift)
            {
                EmitKey(KEY_LEFTSHIFT, true);
            }
            EmitKey(mapping->code, true);
            return Napi::Boolean::New(env, true);
        }
        EmitKey(*code, true);
        return Napi::Boolean::New(env, true);
    }

    HandleKeyEvent(key, true);
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyUp(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string que identifique la tecla").ThrowAsJavaScriptException();
        return env.Null();
    }
    std::string key = Normalize(info[0].As<Napi::String>().Utf8Value());

    if (UseUinput())
    {
        auto code = ResolveUinputKey(key);
        if (!code)
        {
            auto mapping = key.size() == 1 ? ResolveUinputChar(static_cast<unsigned char>(key[0])) : std::nullopt;
            if (!mapping)
            {
                Napi::TypeError::New(env, "Tecla especial desconocida").ThrowAsJavaScriptException();
                return env.Null();
            }
            EmitKey(mapping->code, false);
            if (mapping->shift)
            {
                EmitKey(KEY_LEFTSHIFT, false);
            }
            return Napi::Boolean::New(env, true);
        }
        EmitKey(*code, false);
        return Napi::Boolean::New(env, true);
    }

    HandleKeyEvent(key, false);
    return Napi::Boolean::New(env, true);
}

Napi::Value TypeText(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Se requiere un string").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::u16string text = info[0].As<Napi::String>().Utf16Value();

    if (UseUinput())
    {
        for (char32_t cp : ToCodepoints(text))
        {
            TypeUinputChar(cp);
        }
        return Napi::Boolean::New(env, true);
    }

    for (char32_t cp : ToCodepoints(text))
    {
        SendCharacterChar32(cp);
    }
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyCombo(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Se requiere un arreglo de teclas").ThrowAsJavaScriptException();
        return env.Null();
    }
    Napi::Array arr = info[0].As<Napi::Array>();

    if (UseUinput())
    {
        std::vector<int> modifiers;
        std::vector<int> presses;

        for (uint32_t i = 0; i < arr.Length(); ++i)
        {
            Napi::Value value = arr[i];
            if (!value.IsString())
            {
                continue;
            }
            std::string key = Normalize(value.As<Napi::String>().Utf8Value());
            auto code = ResolveUinputKey(key);
            if (!code)
            {
                continue;
            }
            if (IsUinputModifier(*code))
            {
                if (std::find(modifiers.begin(), modifiers.end(), *code) == modifiers.end())
                {
                    modifiers.push_back(*code);
                }
            }
            else
            {
                presses.push_back(*code);
            }
        }

        for (int mod : modifiers)
        {
            EmitKey(mod, true);
        }
        for (int code : presses)
        {
            TapKey(code);
        }
        for (auto it = modifiers.rbegin(); it != modifiers.rend(); ++it)
        {
            EmitKey(*it, false);
        }
        return Napi::Boolean::New(env, true);
    }

    std::vector<KeySym> modifiers;
    std::vector<KeySym> presses;

    for (uint32_t i = 0; i < arr.Length(); ++i)
    {
        Napi::Value value = arr[i];
        if (!value.IsString())
        {
            continue;
        }
        std::string key = Normalize(value.As<Napi::String>().Utf8Value());
        KeySym keysym = ResolveKeySym(key);
        if (keysym == NoSymbol)
        {
            continue;
        }
        if (IsModifier(keysym))
        {
            if (std::find(modifiers.begin(), modifiers.end(), keysym) == modifiers.end())
            {
                modifiers.push_back(keysym);
            }
        }
        else
        {
            presses.push_back(keysym);
        }
    }

    for (KeySym mod : modifiers)
    {
        SendKeySym(mod, true);
    }
    for (KeySym key : presses)
    {
        SendKeySymPress(key);
    }
    for (auto it = modifiers.rbegin(); it != modifiers.rend(); ++it)
    {
        SendKeySym(*it, false);
    }
    return Napi::Boolean::New(env, true);
}

// Permite a la capa JS diagnosticar el backend de entrada activo.
Napi::Value GetInputBackend(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    Napi::Object status = Napi::Object::New(env);

    const bool wayland = IsWaylandSession();
    if (UseUinput())
    {
        status.Set("backend", Napi::String::New(env, "uinput"));
    }
    else if (GetDisplay())
    {
        status.Set("backend", Napi::String::New(env, "xtest"));
    }
    else
    {
        status.Set("backend", Napi::String::New(env, "none"));
    }

    status.Set("wayland", Napi::Boolean::New(env, wayland));
    status.Set("uinputReady", Napi::Boolean::New(env, Uinput().ready));
    status.Set("error", Napi::String::New(env, Uinput().error));
    return status;
}

// Libera el dispositivo virtual (equivale a desconectar el teclado/ratón).
Napi::Value DisposeInput(const Napi::CallbackInfo &info)
{
    DestroyUinput();
    return Napi::Boolean::New(info.Env(), true);
}

Napi::Object InitModule(Napi::Env env, Napi::Object exports)
{
    exports.Set("moveRelative", Napi::Function::New(env, MoveMouseRelative));
    exports.Set("getPosition", Napi::Function::New(env, GetMousePosition));
    exports.Set("click", Napi::Function::New(env, Click));
    exports.Set("doubleClick", Napi::Function::New(env, DoubleClick));
    exports.Set("scroll", Napi::Function::New(env, Scroll));
    exports.Set("mouseDown", Napi::Function::New(env, MouseDown));
    exports.Set("mouseUp", Napi::Function::New(env, MouseUp));
    exports.Set("typeText", Napi::Function::New(env, TypeText));
    exports.Set("keyTap", Napi::Function::New(env, KeyTap));
    exports.Set("keyDown", Napi::Function::New(env, KeyDown));
    exports.Set("keyUp", Napi::Function::New(env, KeyUp));
    exports.Set("keyCombo", Napi::Function::New(env, KeyCombo));
    exports.Set("getInputBackend", Napi::Function::New(env, GetInputBackend));
    exports.Set("dispose", Napi::Function::New(env, DisposeInput));
    return exports;
}

NODE_API_MODULE(mouse_controller, InitModule)

#endif
