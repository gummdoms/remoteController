#include <napi.h>
#include <algorithm>
#include <map>
#include <string>
#include <vector>

#ifdef _WIN32

#include <windows.h>

namespace
{
    bool NeedsExtendedKeyFlag(WORD vk)
    {
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

    void SendVirtualKeyEvent(WORD vk, bool keyDown)
    {
        INPUT input = {};
        input.type = INPUT_KEYBOARD;

        WORD scanCode = static_cast<WORD>(MapVirtualKey(vk, MAPVK_VK_TO_VSC));
        if (scanCode)
        {
            input.ki.wScan = scanCode;
            input.ki.dwFlags = KEYEVENTF_SCANCODE;
        }
        else
        {
            input.ki.wVk = vk;
        }

        if (NeedsExtendedKeyFlag(vk))
        {
            input.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
        }

        if (!keyDown)
        {
            input.ki.dwFlags |= KEYEVENTF_KEYUP;
        }

        SendInput(1, &input, sizeof(INPUT));
    }

    void SendVirtualKeyPress(WORD vk)
    {
        INPUT inputs[2] = {};
        WORD scanCode = static_cast<WORD>(MapVirtualKey(vk, MAPVK_VK_TO_VSC));

        for (int i = 0; i < 2; ++i)
        {
            inputs[i].type = INPUT_KEYBOARD;
            if (scanCode)
            {
                inputs[i].ki.wScan = scanCode;
                inputs[i].ki.dwFlags = KEYEVENTF_SCANCODE;
            }
            else
            {
                inputs[i].ki.wVk = vk;
            }

            if (NeedsExtendedKeyFlag(vk))
            {
                inputs[i].ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
            }
        }

        inputs[1].ki.dwFlags |= KEYEVENTF_KEYUP;
        SendInput(2, inputs, sizeof(INPUT));
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
        {"backspace", VK_BACK}, {"enter", VK_RETURN}, {"return", VK_RETURN}, {"space", VK_SPACE}, {"tab", VK_TAB}, {"esc", VK_ESCAPE}, {"escape", VK_ESCAPE}, {"delete", VK_DELETE}, {"del", VK_DELETE}, {"insert", VK_INSERT}, {"home", VK_HOME}, {"end", VK_END}, {"pageup", VK_PRIOR}, {"pagedown", VK_NEXT}, {"up", VK_UP}, {"down", VK_DOWN}, {"left", VK_LEFT}, {"right", VK_RIGHT}, {"capslock", VK_CAPITAL}, {"numlock", VK_NUMLOCK}, {"scrolllock", VK_SCROLL}, {"numpad0", VK_NUMPAD0}, {"numpad1", VK_NUMPAD1}, {"numpad2", VK_NUMPAD2}, {"numpad3", VK_NUMPAD3}, {"numpad4", VK_NUMPAD4}, {"numpad5", VK_NUMPAD5}, {"numpad6", VK_NUMPAD6}, {"numpad7", VK_NUMPAD7}, {"numpad8", VK_NUMPAD8}, {"numpad9", VK_NUMPAD9}, {"printscreen", VK_SNAPSHOT}, {"pause", VK_PAUSE}, {"pausebreak", VK_PAUSE}, {"f1", VK_F1}, {"f2", VK_F2}, {"f3", VK_F3}, {"f4", VK_F4}, {"f5", VK_F5}, {"f6", VK_F6}, {"f7", VK_F7}, {"f8", VK_F8}, {"f9", VK_F9}, {"f10", VK_F10}, {"f11", VK_F11}, {"f12", VK_F12}, {"media_play", VK_MEDIA_PLAY_PAUSE}, {"media_stop", VK_MEDIA_STOP}, {"media_next", VK_MEDIA_NEXT_TRACK}, {"media_prev", VK_MEDIA_PREV_TRACK}, {"volume_up", VK_VOLUME_UP}, {"volume_down", VK_VOLUME_DOWN}, {"volume_mute", VK_VOLUME_MUTE}, {"lwin", VK_LWIN}, {"rwin", VK_RWIN}, {"win", VK_LWIN}, {"windows", VK_LWIN}, {"super", VK_LWIN}, {"meta", VK_LWIN}, {"ctrl", VK_CONTROL}, {"control", VK_CONTROL}, {"lctrl", VK_LCONTROL}, {"rctrl", VK_RCONTROL}, {"alt", VK_MENU}, {"lalt", VK_LMENU}, {"ralt", VK_RMENU}, {"shift", VK_SHIFT}, {"lshift", VK_LSHIFT}, {"rshift", VK_RSHIFT}, {"mayus", VK_SHIFT}};
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

    SendVirtualKeyPress(it->second);
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
        SendVirtualKeyEvent(it->second, true);
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
        SendVirtualKeyEvent(it->second, false);
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

#include <cctype>
#include <cmath>
#include <optional>
#include <unordered_map>

namespace
{
    Display *GetDisplay()
    {
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
            return false;
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
        {"backspace", XK_BackSpace}, {"enter", XK_Return}, {"return", XK_Return}, {"space", XK_space}, {"tab", XK_Tab}, {"esc", XK_Escape}, {"escape", XK_Escape}, {"delete", XK_Delete}, {"del", XK_Delete}, {"insert", XK_Insert}, {"home", XK_Home}, {"end", XK_End}, {"pageup", XK_Prior}, {"pagedown", XK_Next}, {"up", XK_Up}, {"down", XK_Down}, {"left", XK_Left}, {"right", XK_Right}, {"capslock", XK_Caps_Lock}, {"numlock", XK_Num_Lock}, {"scrolllock", XK_Scroll_Lock}, {"numpad0", XK_KP_0}, {"numpad1", XK_KP_1}, {"numpad2", XK_KP_2}, {"numpad3", XK_KP_3}, {"numpad4", XK_KP_4}, {"numpad5", XK_KP_5}, {"numpad6", XK_KP_6}, {"numpad7", XK_KP_7}, {"numpad8", XK_KP_8}, {"numpad9", XK_KP_9}, {"printscreen", XK_Print}, {"pause", XK_Pause}, {"pausebreak", XK_Pause}, {"f1", XK_F1}, {"f2", XK_F2}, {"f3", XK_F3}, {"f4", XK_F4}, {"f5", XK_F5}, {"f6", XK_F6}, {"f7", XK_F7}, {"f8", XK_F8}, {"f9", XK_F9}, {"f10", XK_F10}, {"f11", XK_F11}, {"f12", XK_F12}, {"media_play", XF86XK_AudioPlay}, {"media_stop", XF86XK_AudioStop}, {"media_next", XF86XK_AudioNext}, {"media_prev", XF86XK_AudioPrev}, {"volume_up", XF86XK_AudioRaiseVolume}, {"volume_down", XF86XK_AudioLowerVolume}, {"volume_mute", XF86XK_AudioMute}, {"lwin", XK_Super_L}, {"rwin", XK_Super_R}, {"win", XK_Super_L}, {"windows", XK_Super_L}, {"super", XK_Super_L}, {"meta", XK_Super_L}, {"ctrl", XK_Control_L}, {"control", XK_Control_L}, {"lctrl", XK_Control_L}, {"rctrl", XK_Control_R}, {"alt", XK_Alt_L}, {"lalt", XK_Alt_L}, {"ralt", XK_Alt_R}, {"shift", XK_Shift_L}, {"lshift", XK_Shift_L}, {"rshift", XK_Shift_R}, {"mayus", XK_Shift_L}};

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
    if (!EnsureDisplay(env))
    {
        return env.Null();
    }

    int dx = info[0].As<Napi::Number>().Int32Value();
    int dy = info[1].As<Napi::Number>().Int32Value();

    XTestFakeRelativeMotionEvent(GetDisplay(), dx, dy, CurrentTime);
    XFlush(GetDisplay());
    return Napi::Boolean::New(env, true);
}

Napi::Value GetMousePosition(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
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

#endif
