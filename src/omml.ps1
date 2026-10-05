param([string]$InputBase64)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$candidates = @("$env:ProgramFiles\Microsoft Office\root\Office16\OMML2MML.XSL", "${env:ProgramFiles(x86)}\Microsoft Office\root\Office16\OMML2MML.XSL", "$env:ProgramFiles\Microsoft Office\Office16\OMML2MML.XSL")
$xsl = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $xsl) { throw '本机未找到 Word 公式转换组件。请在 Word 中选择复制 MathML 到剪贴板后重试。' }
$xml = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($InputBase64))
$xml = '<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + $xml + '</root>'
$settings = [Xml.XmlReaderSettings]::new(); $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit; $settings.XmlResolver = $null
$reader = [Xml.XmlReader]::Create([IO.StringReader]::new($xml), $settings)
$transform = [Xml.Xsl.XslCompiledTransform]::new(); $transform.Load($xsl, [Xml.Xsl.XsltSettings]::Default, $null)
$output = [IO.StringWriter]::new(); $transform.Transform($reader, $null, $output)
[Console]::Write($output.ToString())
