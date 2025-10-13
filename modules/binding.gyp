{
  "targets": [
    {
      "target_name": "mouse_controller",
      "sources": [ "mouse-controller.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    },
    {
      "target_name": "alert_controller",
      "type": "executable",
      "sources": [ "alert-controller.cc" ],
      "defines": [
        "UNICODE",
        "_UNICODE",
        "_WIN32_WINNT=0x0601"
      ],
      "libraries": [
        "gdiplus.lib",
        "dwmapi.lib",
        "shcore.lib"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/std:c++17" ]
        },
        "VCLinkerTool": {
          "SubSystem": 2,
          "EntryPointSymbol": "wWinMainCRTStartup"
        }
      }
    }
  ]
}
