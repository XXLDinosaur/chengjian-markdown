param([string]$Source = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
# Metafile rendering preserves the original vector drawing at four times its display size.
# https://learn.microsoft.com/dotnet/api/system.drawing.imaging.metafile
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeImageClipboard {
 [DllImport("user32.dll")] public static extern bool OpenClipboard(IntPtr owner);
 [DllImport("user32.dll")] public static extern bool CloseClipboard();
 [DllImport("user32.dll")] public static extern IntPtr GetClipboardData(uint format);
 [DllImport("user32.dll")] public static extern bool IsClipboardFormatAvailable(uint format);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr CopyEnhMetaFile(IntPtr source,string file);
}
'@
$metafile = $null; $bitmap = $null; $graphics = $null; $stream = $null
try {
 if ($Source) { $metafile = [System.Drawing.Imaging.Metafile]::new($Source) }
 else {
  if (-not [NativeImageClipboard]::IsClipboardFormatAvailable(14)) { return }
  if (-not [NativeImageClipboard]::OpenClipboard([IntPtr]::Zero)) { return }
  try {
   $handle = [NativeImageClipboard]::GetClipboardData(14)
   if ($handle -eq [IntPtr]::Zero) { return }
   $copy = [NativeImageClipboard]::CopyEnhMetaFile($handle,$null)
   if ($copy -eq [IntPtr]::Zero) { return }
   $metafile = [System.Drawing.Imaging.Metafile]::new($copy,$true)
  } finally { [void][NativeImageClipboard]::CloseClipboard() }
 }
 $width = $metafile.Width; $height = $metafile.Height
 if ($width -le 0 -or $height -le 0 -or $width -gt 8192 -or $height -gt 8192) { return }
 $scale = [Math]::Min(4,[Math]::Sqrt(16000000 / ([double]$width * $height)))
 $bitmap = [System.Drawing.Bitmap]::new([int][Math]::Ceiling($width*$scale),[int][Math]::Ceiling($height*$scale),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $bitmap.SetResolution(384,384)
 $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.Clear([System.Drawing.Color]::Transparent)
 $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
 $graphics.DrawImage($metafile,[System.Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height))
 $stream = [System.IO.MemoryStream]::new()
 $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
 @{png=[Convert]::ToBase64String($stream.ToArray());width=$width;height=$height} | ConvertTo-Json -Compress
} finally {
 if ($graphics) { $graphics.Dispose() }; if ($bitmap) { $bitmap.Dispose() }
 if ($metafile) { $metafile.Dispose() }; if ($stream) { $stream.Dispose() }
}
