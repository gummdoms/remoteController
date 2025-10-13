#include <napi.h>
#include <windows.h>
#include <algorithm>
#include <map>
#include <string>
#include <vector>

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
        {"backspace", VK_BACK}, {"enter", VK_RETURN}, {"return", VK_RETURN}, {"space", VK_SPACE}, {"tab", VK_TAB}, {"esc", VK_ESCAPE}, {"escape", VK_ESCAPE}, {"delete", VK_DELETE}, {"del", VK_DELETE}, {"insert", VK_INSERT}, {"home", VK_HOME}, {"end", VK_END}, {"pageup", VK_PRIOR}, {"pagedown", VK_NEXT}, {"up", VK_UP}, {"down", VK_DOWN}, {"left", VK_LEFT}, {"right", VK_RIGHT}, {"capslock", VK_CAPITAL}, {"numlock", VK_NUMLOCK}, {"scrolllock", VK_SCROLL}, {"printscreen", VK_SNAPSHOT}, {"pause", VK_PAUSE}, {"pausebreak", VK_PAUSE}, {"f1", VK_F1}, {"f2", VK_F2}, {"f3", VK_F3}, {"f4", VK_F4}, {"f5", VK_F5}, {"f6", VK_F6}, {"f7", VK_F7}, {"f8", VK_F8}, {"f9", VK_F9}, {"f10", VK_F10}, {"f11", VK_F11}, {"f12", VK_F12}, {"media_play", VK_MEDIA_PLAY_PAUSE}, {"media_stop", VK_MEDIA_STOP}, {"media_next", VK_MEDIA_NEXT_TRACK}, {"media_prev", VK_MEDIA_PREV_TRACK}, {"volume_up", VK_VOLUME_UP}, {"volume_down", VK_VOLUME_DOWN}, {"volume_mute", VK_VOLUME_MUTE}, {"lwin", VK_LWIN}, {"rwin", VK_RWIN}, {"win", VK_LWIN}, {"windows", VK_LWIN}, {"super", VK_LWIN}, {"meta", VK_LWIN}, {"ctrl", VK_CONTROL}, {"control", VK_CONTROL}, {"lctrl", VK_LCONTROL}, {"rctrl", VK_RCONTROL}, {"alt", VK_MENU}, {"lalt", VK_LMENU}, {"ralt", VK_RMENU}, {"shift", VK_SHIFT}, {"lshift", VK_LSHIFT}, {"rshift", VK_RSHIFT}, {"mayus", VK_SHIFT}};
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
