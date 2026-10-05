param([string]$Output)
Add-Type -AssemblyName System.Drawing
$bitmap=[System.Drawing.Bitmap]::new(160,80)
$g=[System.Drawing.Graphics]::FromImage($bitmap)
$hdc=$g.GetHdc()
try {$meta=[System.Drawing.Imaging.Metafile]::new($Output,$hdc,[System.Drawing.Rectangle]::new(0,0,160,80),[System.Drawing.Imaging.MetafileFrameUnit]::Pixel)} finally {$g.ReleaseHdc($hdc)}
$draw=[System.Drawing.Graphics]::FromImage($meta)
$font=[System.Drawing.Font]::new('Cambria',18)
$draw.DrawString('a + b',$font,[System.Drawing.Brushes]::Black,20,10)
$draw.DrawLine([System.Drawing.Pens]::Black,18,42,105,42)
$draw.DrawString('2',$font,[System.Drawing.Brushes]::Black,54,44)
$draw.Dispose();$font.Dispose();$meta.Dispose();$g.Dispose();$bitmap.Dispose()
