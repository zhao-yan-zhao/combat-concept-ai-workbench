param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module "$env:USERPROFILE\.codex\skills\.shared\office-com\scripts\office_com_common.psm1" -Force

$msoFalse = 0
$msoTrue = -1
$msoTextOrientationHorizontal = 1
$msoShapeRectangle = 1
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24
$ppSlideSizeOnScreen16x9 = 15

function Get-PropertyValue {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-Items {
    param($Value)
    if ($null -eq $Value) { return @() }
    return @($Value)
}

function As-Text {
    param($Value, [string]$Fallback = '')
    if ($null -eq $Value) { return $Fallback }
    return [string]$Value
}

function Short-Text {
    param($Value, [int]$Maximum = 58, [string]$Fallback = '待补充')
    $text = (As-Text $Value $Fallback).Trim()
    if ($text.Length -le $Maximum) { return $text }
    return "$($text.Substring(0, $Maximum - 1))..."
}

function To-Point {
    param([double]$Inches)
    return [single]($Inches * 72)
}

function Get-OleColor {
    param([string]$Hex)
    $value = $Hex.TrimStart('#')
    $red = [Convert]::ToInt32($value.Substring(0, 2), 16)
    $green = [Convert]::ToInt32($value.Substring(2, 2), 16)
    $blue = [Convert]::ToInt32($value.Substring(4, 2), 16)
    return $red + ($green -shl 8) + ($blue -shl 16)
}

function Set-ShapeFill {
    param($Shape, [string]$Color)
    $Shape.Fill.Visible = $msoTrue
    $Shape.Fill.Solid()
    $Shape.Fill.ForeColor.RGB = Get-OleColor $Color
    $Shape.Line.Visible = $msoFalse
}

function Add-Block {
    param($Slide, [double]$X, [double]$Y, [double]$Width, [double]$Height, [string]$Color)
    $shape = $Slide.Shapes.AddShape($msoShapeRectangle, (To-Point $X), (To-Point $Y), (To-Point $Width), (To-Point $Height))
    Set-ShapeFill $shape $Color
}

function Add-Text {
    param(
        $Slide,
        [string]$Text,
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [int]$Size = 18,
        [string]$Color = '17212B',
        [bool]$Bold = $false,
        [int]$Alignment = 1
    )
    $shape = $Slide.Shapes.AddTextbox($msoTextOrientationHorizontal, (To-Point $X), (To-Point $Y), (To-Point $Width), (To-Point $Height))
    $shape.TextFrame.MarginLeft = 0
    $shape.TextFrame.MarginRight = 0
    $shape.TextFrame.MarginTop = 0
    $shape.TextFrame.MarginBottom = 0
    $shape.TextFrame.WordWrap = $msoTrue
    $shape.TextFrame.TextRange.Text = $Text
    $shape.TextFrame.TextRange.Font.Name = 'Aptos'
    $shape.TextFrame.TextRange.Font.NameFarEast = 'Microsoft YaHei'
    $shape.TextFrame.TextRange.Font.Size = $Size
    $shape.TextFrame.TextRange.Font.Bold = if ($Bold) { $msoTrue } else { $msoFalse }
    $shape.TextFrame.TextRange.Font.Color.RGB = Get-OleColor $Color
    $shape.TextFrame.TextRange.ParagraphFormat.Alignment = $Alignment
}

function Add-Footer {
    param($Slide, [int]$Page)
    Add-Text $Slide '作战概念研究工作台 | 研究汇报' 0.55 7.04 5.5 0.20 9 '5D7182' $false 1
    Add-Text $Slide ([string]$Page) 12.10 7.04 0.60 0.20 9 '5D7182' $false 3
}

function Add-Metric {
    param($Slide, [string]$Value, [string]$Label, [double]$X, [string]$Accent)
    Add-Block $Slide $X 5.76 2.0 0.82 '24313B'
    Add-Block $Slide $X 5.76 0.08 0.82 $Accent
    Add-Text $Slide $Value ($X + 0.22) 5.90 1.58 0.28 22 'FFFFFF' $true 1
    Add-Text $Slide $Label ($X + 0.22) 6.29 1.58 0.18 9 'B8C4CD' $false 1
}

function Add-ProcessNode {
    param($Slide, [string]$Text, [double]$X, [double]$Y, [double]$Width, [string]$Accent)
    Add-Block $Slide $X $Y $Width 0.78 'FFFFFF'
    Add-Block $Slide $X $Y 0.07 0.78 $Accent
    Add-Text $Slide $Text ($X + 0.18) ($Y + 0.18) ($Width - 0.28) 0.40 13 '17212B' $true 1
}

function Add-SectionTitle {
    param($Slide, [string]$Title, [string]$Eyebrow)
    Add-Text $Slide $Eyebrow 0.62 0.44 4.8 0.22 10 '0D7C72' $true 1
    Add-Text $Slide $Title 0.62 0.78 8.9 0.58 30 '17212B' $true 1
}

$payload = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$project = Get-PropertyValue $payload 'project'
$ov1 = Get-PropertyValue $payload 'ov1'
$ov5 = Get-PropertyValue $payload 'ov5'
$ooda = Get-PropertyValue $payload 'ooda'
$scenario = Get-PropertyValue $payload 'scenario'
$bridge = Get-PropertyValue $payload 'deploymentBridge'
$validation = Get-PropertyValue $payload 'validation'
$knowledge = Get-PropertyValue $payload 'knowledge'
$maturity = Get-PropertyValue $payload 'validationMaturity'
$reportTemplate = Get-PropertyValue $payload 'reportTemplate'
$templateTitle = As-Text (Get-PropertyValue $reportTemplate 'documentTitle') '作战概念研究报告'
$templateLabel = As-Text (Get-PropertyValue $reportTemplate 'label') '研究通用'

$activities = @(Get-Items (Get-PropertyValue $ov5 'activities') | Select-Object -First 5)
$lanes = @(Get-Items (Get-PropertyValue $ooda 'lanes') | Select-Object -First 4)
$deployment = Get-PropertyValue $scenario 'deploymentData'
$entities = @(Get-Items (Get-PropertyValue $deployment 'entities') | Select-Object -First 4)
$scores = @(Get-Items (Get-PropertyValue $validation 'scores') | Select-Object -First 4)
$issues = @(Get-Items (Get-PropertyValue $validation 'issues') | Select-Object -First 3)
$review = Get-PropertyValue $validation 'redTeamReview'
$findings = @(Get-Items (Get-PropertyValue $review 'findings') | Select-Object -First 2)
$evidence = Get-PropertyValue $knowledge 'evidence'
$evidenceEntries = @(Get-Items (Get-PropertyValue $evidence 'entries') | Select-Object -First 4)
$oodaNodeCount = @($lanes | ForEach-Object { Get-Items (Get-PropertyValue $_ 'nodes') }).Count

$powerPoint = $null
$presentation = $null
try {
    Assert-OfficeComAvailable -AppName PowerPoint | Out-Null
    $powerPoint = New-Object -ComObject PowerPoint.Application
    # This PowerPoint build rejects a hidden application window during COM automation.
    $powerPoint.Visible = $msoTrue
    $presentation = $powerPoint.Presentations.Add($msoFalse)
    $presentation.PageSetup.SlideSize = $ppSlideSizeOnScreen16x9
    # PowerPoint's 16:9 preset is 10 x 5.625 inches; the deck uses the standard wide 13.333 x 7.5 canvas.
    $presentation.PageSetup.SlideWidth = To-Point 13.333
    $presentation.PageSetup.SlideHeight = To-Point 7.5

    $slide = $presentation.Slides.Add(1, $ppLayoutBlank)
    Add-Block $slide 0 0 13.333 7.5 '17212B'
    Add-Block $slide 9.80 0 3.533 7.5 '0D7C72'
    Add-Block $slide 10.55 0 2.783 7.5 'D7A94B'
    Add-Block $slide 0.62 0.72 0.10 0.82 'D7A94B'
    Add-Text $slide '作战概念研究工作台' 0.90 0.78 5.6 0.32 13 'B8C4CD' $true 1
    Add-Text $slide "$(Short-Text (Get-PropertyValue $project 'title') 30 '作战概念')`n$templateTitle" 0.90 1.42 7.8 1.40 32 'FFFFFF' $true 1
    Add-Text $slide (Short-Text (Get-PropertyValue $project 'direction') 60 '概念方向待补充') 0.90 3.08 6.9 0.40 16 'B8C4CD' $false 1
    Add-Text $slide "报告模板：$templateLabel`n报告版本：$(As-Text (Get-PropertyValue (Get-PropertyValue $payload 'reportVersion') 'label') '未归档草稿')`n生成时间：$(As-Text (Get-PropertyValue $payload 'generatedAt'))" 0.90 3.74 6.7 0.82 11 'D8E0E5' $false 1
    Add-Metric $slide ([string]$activities.Count) 'OV-5 活动' 0.90 '0D7C72'
    Add-Metric $slide ([string]$oodaNodeCount) 'OODA 节点' 3.08 'D7A94B'
    Add-Metric $slide ([string]$entities.Count) '想定实体' 5.26 'B94A48'
    Add-Text $slide '从概念到可审阅想定' 9.15 6.62 3.45 0.28 13 '17212B' $true 3

    $slide = $presentation.Slides.Add(2, $ppLayoutBlank)
    Add-Block $slide 0 0 13.333 7.5 'F3F5F6'
    Add-SectionTitle $slide '概念简报与 OV-5 活动链' 'CONCEPT BRIEF / OV-5'
    Add-Block $slide 0.62 1.65 3.35 4.80 'FFFFFF'
    Add-Text $slide '概念简报' 0.92 1.98 2.6 0.32 16 '17212B' $true 1
    $brief = Get-PropertyValue $project 'brief'
    Add-Text $slide "作战目标`n$(Short-Text (Get-PropertyValue $brief 'objective') 80)" 0.92 2.55 2.52 0.94 12 '344654' $false 1
    Add-Text $slide "核心思路`n$(Short-Text (Get-PropertyValue $brief 'approach') 80)" 0.92 3.68 2.52 0.94 12 '344654' $false 1
    Add-Text $slide "关键假设`n$(Short-Text (Get-PropertyValue $brief 'assumptions') 80)" 0.92 4.81 2.52 0.94 12 '344654' $false 1
    Add-Text $slide "主要风险`n$(Short-Text (Get-PropertyValue $brief 'risk') 80)" 0.92 5.94 2.52 0.40 12 'B94A48' $false 1
    Add-Text $slide '关键活动与信息流' 4.55 1.86 4.8 0.30 16 '17212B' $true 1
    if (-not $activities.Count) {
        Add-Text $slide '尚未定义 OV-5 活动。' 4.55 2.55 5.8 0.30 15 '70808C' $false 1
    }
    else {
        $nodeWidth = if ($activities.Count -le 4) { 1.48 } else { 1.52 }
        for ($index = 0; $index -lt $activities.Count; $index += 1) {
            $x = if ($activities.Count -le 4) { 4.55 + $index * 1.93 } else { 4.55 + ($index % 3) * 2.20 }
            $y = if ($activities.Count -le 4) { 3.10 } else { 2.55 + [Math]::Floor($index / 3) * 1.32 }
            $accent = @('0D7C72', 'D7A94B', 'B94A48', '5D7182', '0D7C72')[$index]
            Add-ProcessNode $slide (Short-Text (Get-PropertyValue $activities[$index] 'title') 18) $x $y $nodeWidth $accent
            if ($index -lt ($activities.Count - 1) -and (($activities.Count -le 4) -or ($index % 3) -ne 2)) {
                $connectorWidth = if ($activities.Count -le 4) { 0.45 } else { 0.45 }
                Add-Block $slide ($x + $nodeWidth) ($y + 0.36) $connectorWidth 0.04 'A9B8C2'
            }
        }
    }
    $ov1Nodes = @(Get-Items (Get-PropertyValue $ov1 'nodes') | Select-Object -First 4)
    Add-Text $slide "OV-1 概念要素：$(if ($ov1Nodes.Count) { ($ov1Nodes | ForEach-Object { Short-Text (Get-PropertyValue $_ 'label') 16 }) -join ' / ' } else { '未提供' })" 4.55 5.72 7.82 0.42 12 '5D7182' $false 1
    Add-Footer $slide 2

    $slide = $presentation.Slides.Add(3, $ppLayoutBlank)
    Add-Block $slide 0 0 13.333 7.5 'FFFFFF'
    Add-SectionTitle $slide 'OODA 行为循环与自动想定' 'OODA / SCENARIO'
    $phaseColors = @('0D7C72', '5D7182', 'D7A94B', 'B94A48')
    for ($index = 0; $index -lt 4; $index += 1) {
        $lane = if ($index -lt $lanes.Count) { $lanes[$index] } else { $null }
        $x = 0.62 + $index * 3.12
        Add-Block $slide $x 1.72 2.72 2.10 'F3F5F6'
        Add-Block $slide $x 1.72 2.72 0.10 $phaseColors[$index]
        Add-Text $slide (As-Text (Get-PropertyValue $lane 'title') @('Observe', 'Orient', 'Decide', 'Act')[$index]) ($x + 0.20) 2.00 2.20 0.30 16 '17212B' $true 1
        $firstNode = @(Get-Items (Get-PropertyValue $lane 'nodes') | Select-Object -First 1)[0]
        Add-Text $slide (Short-Text (Get-PropertyValue $firstNode 'title') 32 '待补充节点') ($x + 0.20) 2.57 2.24 0.34 13 '344654' $false 1
        Add-Text $slide "耗时：$(As-Text (Get-PropertyValue $firstNode 'duration') '待估算')" ($x + 0.20) 3.22 2.20 0.24 11 '5D7182' $false 1
    }
    Add-Text $slide "周期估算：$(As-Text (Get-PropertyValue $ooda 'durationMinutes') '待估算') 分钟" 0.62 4.20 3.2 0.28 13 '0D7C72' $true 1
    Add-Block $slide 0.62 4.72 12.08 1.60 '17212B'
    Add-Text $slide '自动想定部署概览' 0.92 5.00 2.8 0.28 16 'FFFFFF' $true 1
    if ($entities.Count) {
        for ($index = 0; $index -lt $entities.Count; $index += 1) {
            $x = 3.80 + $index * 2.08
            $accent = @('0D7C72', 'D7A94B', 'B94A48', '5D7182')[$index]
            Add-Block $slide $x 5.05 1.66 0.76 $accent
            Add-Text $slide (Short-Text ((Get-PropertyValue $entities[$index] 'name'), (Get-PropertyValue $entities[$index] 'title'), (Get-PropertyValue $entities[$index] 'id') | Where-Object { $_ } | Select-Object -First 1) 18 '想定实体') ($x + 0.14) 5.27 1.35 0.28 11 'FFFFFF' $true 2
        }
    }
    else {
        Add-Text $slide '尚未生成想定实体。' 3.80 5.28 3.2 0.30 13 'D8E0E5' $false 1
    }
    Add-Footer $slide 3

    $slide = $presentation.Slides.Add(4, $ppLayoutBlank)
    Add-Block $slide 0 0 13.333 7.5 'F3F5F6'
    Add-SectionTitle $slide '部署桥接与设计验证' 'DEPLOYMENT / VALIDATION'
    Add-Block $slide 0.62 1.68 3.25 4.96 '17212B'
    Add-Text $slide '部署图桥接' 0.92 2.00 2.30 0.30 16 'FFFFFF' $true 1
    Add-Text $slide "当前状态`n$(As-Text (Get-PropertyValue $bridge 'status') '未配置')" 0.92 2.72 2.40 0.72 15 'B8C4CD' $false 1
    Add-Text $slide "目标地址`n$(Short-Text (Get-PropertyValue $bridge 'targetUrl') 42 '未配置')" 0.92 3.74 2.40 0.72 11 'B8C4CD' $false 1
    Add-Text $slide "同步想定`n$(As-Text (Get-PropertyValue $bridge 'scenarioId') '尚未生成')" 0.92 4.78 2.40 0.72 12 'FFFFFF' $false 1
    Add-Text $slide "实体数量：$($entities.Count)" 0.92 5.86 2.40 0.26 11 'D7A94B' $true 1
    Add-Text $slide '验证评分' 4.52 1.94 2.2 0.30 16 '17212B' $true 1
    if ($scores.Count) {
        for ($index = 0; $index -lt $scores.Count; $index += 1) {
            $score = $scores[$index]
            $x = 4.52 + $index * 1.88
            $value = [Math]::Min(100, [Math]::Max(0, [int](Get-PropertyValue $score 'score')))
            Add-Block $slide $x 3.85 1.05 1.64 'D8E0E5'
            Add-Block $slide $x (5.49 - 1.64 * $value / 100) 1.05 (1.64 * $value / 100) @('0D7C72', '5D7182', 'D7A94B', 'B94A48')[$index]
            Add-Text $slide ([string]$value) $x 3.18 1.05 0.30 18 '17212B' $true 2
            Add-Text $slide (Short-Text (Get-PropertyValue $score 'label') 12) ($x - 0.20) 5.66 1.45 0.38 11 '344654' $false 2
        }
    }
    else {
        Add-Text $slide '尚未运行设计验证。' 4.52 3.25 4.0 0.30 14 '70808C' $false 1
    }
    Add-Block $slide 4.52 6.13 7.86 0.51 'FFFFFF'
    $issueText = if ($issues.Count) { ($issues | ForEach-Object { "[$(As-Text (Get-PropertyValue $_ 'level'))] $(Short-Text (Get-PropertyValue $_ 'title') 24)" }) -join '  ·  ' } else { '当前没有待处理验证问题。' }
    Add-Text $slide "待处理问题：$issueText" 4.80 6.29 7.20 0.20 10 '344654' $false 1
    Add-Footer $slide 4

    $slide = $presentation.Slides.Add(5, $ppLayoutBlank)
    Add-Block $slide 0 0 13.333 7.5 'FFFFFF'
    Add-SectionTitle $slide '成熟度、知识依据与修订建议' 'READINESS / EVIDENCE'
    Add-Block $slide 0.62 1.70 3.20 4.90 '0D7C72'
    Add-Text $slide (As-Text (Get-PropertyValue $maturity 'label') '待完善') 0.94 2.05 2.48 0.44 24 'FFFFFF' $true 1
    Add-Text $slide "$(As-Text (Get-PropertyValue $maturity 'readyCount') '0') / $(As-Text (Get-PropertyValue $maturity 'totalCount') '0') 项成熟度检查已满足" 0.94 2.77 2.42 0.45 14 'D8F0EC' $false 1
    $maturityChecks = @(Get-Items (Get-PropertyValue $maturity 'checks') | Select-Object -First 4)
    for ($index = 0; $index -lt $maturityChecks.Count; $index += 1) {
        Add-Text $slide "$(As-Text (Get-PropertyValue $maturityChecks[$index] 'statusLabel'))  $(Short-Text (Get-PropertyValue $maturityChecks[$index] 'label') 24)" 0.94 (3.66 + $index * 0.50) 2.42 0.25 11 'FFFFFF' $false 1
    }
    Add-Text $slide '知识依据' 4.52 1.93 2.0 0.30 16 '17212B' $true 1
    Add-Text $slide "知识库：$(As-Text (Get-PropertyValue $knowledge 'name') '未连接')`n已匹配证据：$($evidenceEntries.Count) 条" 4.52 2.51 3.70 0.58 13 '344654' $false 1
    if ($evidenceEntries.Count) {
        for ($index = 0; $index -lt $evidenceEntries.Count; $index += 1) {
            Add-ProcessNode $slide (Short-Text (Get-PropertyValue $evidenceEntries[$index] 'title') 34) 4.52 (3.38 + $index * 0.62) 4.05 @('0D7C72', 'D7A94B', '5D7182', 'B94A48')[$index]
        }
    }
    else {
        Add-Text $slide '当前模型引用尚未匹配到 Vault 片段。' 4.52 3.52 4.8 0.30 13 '70808C' $false 1
    }
    Add-Block $slide 8.95 1.70 3.43 4.90 '17212B'
    Add-Text $slide '红方修订建议' 9.27 2.05 2.50 0.30 16 'FFFFFF' $true 1
    $findingText = if ($findings.Count) { ($findings | ForEach-Object { "$(Short-Text (Get-PropertyValue $_ 'title') 28)：$(Short-Text (Get-PropertyValue $_ 'recommendation') 48)" }) -join "`n`n" } elseif ($review) { Short-Text (Get-PropertyValue $review 'summary') 130 } else { '尚未形成 AI 红方审阅。' }
    Add-Text $slide $findingText 9.27 2.75 2.52 2.65 12 'D8E0E5' $false 1
    Add-Text $slide '下一步：复核高优先级问题，补充未匹配证据后归档。' 9.27 5.83 2.50 0.38 11 'D7A94B' $true 1
    Add-Footer $slide 5

    $presentation.SaveAs($OutputPath, $ppSaveAsOpenXMLPresentation)
}
finally {
    if ($null -ne $presentation) {
        try { $presentation.Close() } catch { }
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation)
    }
    if ($null -ne $powerPoint) {
        try { $powerPoint.Quit() } catch { }
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
