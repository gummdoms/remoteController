{
  "targets": [
    {
      "target_name": "mouse_controller",
      "sources": ["mouse-controller.cc"],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }],
        ["OS=='linux'", {
          "cflags_cc": ["-std=c++17"],
          "libraries": [
            "-lX11",
            "-lXtst",
            "-lXext"
          ]
        }]
      ]
    }
  ],
  "conditions": [
    ["OS=='win'", {
      "targets": [
        {
          "target_name": "alert_controller",
          "type": "executable",
          "sources": ["alert-controller.cc"],
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
              "ExceptionHandling": 1
            },
            "VCLinkerTool": {
              "SubSystem": 2,
              "EntryPointSymbol": "wWinMainCRTStartup"
            }
          }
        }
      ]
    }]
  ]
}
