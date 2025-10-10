
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DisplaySwitch {
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
"@

$primaryMonitor = [DisplaySwitch]::GetSystemMetrics(80)
$otherMonitors = [DisplaySwitch]::GetSystemMetrics(79)

if ($primaryMonitor -eq 0) {
    Write-Output "4500"
} elseif ($otherMonitors -eq 1) {
    Write-Output "4501"
} elseif ($otherMonitors -eq 2) {
    Write-Output "4502"
} elseif ($otherMonitors -ge 3) {
    Write-Output "4503"
} else {
    Write-Output "4600"
}

        