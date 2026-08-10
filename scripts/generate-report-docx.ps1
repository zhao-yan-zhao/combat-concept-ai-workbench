param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [ValidateSet('docx', 'pdf')]
    [string]$OutputFormat = 'docx'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. "$env:USERPROFILE\.codex\skills\docx-win\scripts\word-common.ps1"

$wdStyleNormal = -1
$wdStyleHeading1 = -2
$wdStyleHeading2 = -3
$wdStyleTitle = -63

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

function Add-Paragraph {
    param(
        $Document,
        [string]$Text,
        [int]$Style = $wdStyleNormal
    )
    $range = $null
    try {
        $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
        $range.Text = "$Text`r"
        $range.Style = $Style
    }
    finally {
        Release-ComObject $range
    }
}

function Add-Table {
    param(
        $Document,
        [string[]]$Headers,
        [object[]]$Rows
    )
    if (-not $Rows.Count) { return }
    $range = $null
    $table = $null
    try {
        $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
        $table = $Document.Tables.Add($range, $Rows.Count + 1, $Headers.Count)
        for ($column = 0; $column -lt $Headers.Count; $column += 1) {
            $table.Cell(1, $column + 1).Range.Text = $Headers[$column]
        }
        $table.Rows.Item(1).Range.Bold = 1
        for ($row = 0; $row -lt $Rows.Count; $row += 1) {
            for ($column = 0; $column -lt $Headers.Count; $column += 1) {
                $value = if ($column -lt $Rows[$row].Count) { $Rows[$row][$column] } else { '' }
                $table.Cell($row + 2, $column + 1).Range.Text = (As-Text $value)
            }
        }
        $table.AutoFitBehavior(2)
    }
    finally {
        Release-ComObject $table
        Release-ComObject $range
    }
}

function Add-ListSection {
    param(
        $Document,
        [string]$Title,
        [object[]]$Items
    )
    Add-Paragraph $Document $Title $wdStyleHeading1
    if (-not $Items.Count) {
        Add-Paragraph $Document '未提供。'
        return
    }
    foreach ($item in $Items) {
        Add-Paragraph $Document "- $(As-Text $item)"
    }
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
$reportVersion = Get-PropertyValue $payload 'reportVersion'
$reportTemplate = Get-PropertyValue $payload 'reportTemplate'
$templateTitle = As-Text (Get-PropertyValue $reportTemplate 'documentTitle') '作战概念研究报告'
$templateLabel = As-Text (Get-PropertyValue $reportTemplate 'label') '研究通用'

$word = $null
$document = $null
try {
    $word = New-WordApplication
    $document = $word.Documents.Add()
    $title = "$(As-Text (Get-PropertyValue $project 'title') '作战概念研究') $templateTitle"
    $document.Sections.Item(1).Headers.Item(1).Range.Text = "作战概念研究工作台 | $templateTitle"
    $null = $document.Sections.Item(1).Footers.Item(1).PageNumbers.Add()

    Add-Paragraph $document $title $wdStyleTitle
    Add-Paragraph $document "报告模板：$templateLabel"
    Add-Paragraph $document "报告版本：$(As-Text (Get-PropertyValue $reportVersion 'label') '未归档草稿')"
    Add-Paragraph $document "生成时间：$(As-Text (Get-PropertyValue $payload 'generatedAt'))"

    Add-Paragraph $document '概念简报' $wdStyleHeading1
    Add-Paragraph $document "概念方向：$(As-Text (Get-PropertyValue $project 'direction'))"
    $brief = Get-PropertyValue $project 'brief'
    Add-Paragraph $document "作战目标：$(As-Text (Get-PropertyValue $brief 'objective'))"
    Add-Paragraph $document "核心思路：$(As-Text (Get-PropertyValue $brief 'approach'))"
    Add-Paragraph $document "关键假设：$(As-Text (Get-PropertyValue $brief 'assumptions'))"
    Add-Paragraph $document "主要风险：$(As-Text (Get-PropertyValue $brief 'risk'))"

    Add-Paragraph $document 'OV-1 总体概念' $wdStyleHeading1
    $ov1Nodes = @(Get-Items (Get-PropertyValue $ov1 'nodes'))
    if ($ov1Nodes.Count) {
        foreach ($node in $ov1Nodes) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'label'))：$(As-Text (Get-PropertyValue $node 'description'))"
        }
    }
    else {
        Add-Paragraph $document '未保存 OV-1 总体概念节点。'
    }

    Add-Paragraph $document 'OV-5 作战活动模型' $wdStyleHeading1
    $activityRows = @()
    foreach ($activity in (Get-Items (Get-PropertyValue $ov5 'activities'))) {
        $activityRows += ,@(
            (As-Text (Get-PropertyValue $activity 'title')),
            (As-Text (Get-PropertyValue $activity 'type')),
            (As-Text (Get-PropertyValue $activity 'input')),
            (As-Text (Get-PropertyValue $activity 'output')),
            (As-Text (Get-PropertyValue $activity 'duration'))
        )
    }
    Add-Table $document @('活动', '类型', '输入', '输出', '耗时') $activityRows
    $edgeDescriptions = @(Get-Items (Get-PropertyValue $ov5 'edges') | ForEach-Object {
        "$(As-Text (Get-PropertyValue $_ 'sourceId')) -> $(As-Text (Get-PropertyValue $_ 'targetId'))（$(As-Text (Get-PropertyValue $_ 'type'))）"
    })
    Add-Paragraph $document "活动关联：$(if ($edgeDescriptions.Count) { $edgeDescriptions -join '；' } else { '未定义' })"

    Add-Paragraph $document 'OODA 行为循环' $wdStyleHeading1
    Add-Paragraph $document "周期估算：$(As-Text (Get-PropertyValue $ooda 'durationMinutes') '待估算') 分钟"
    foreach ($lane in (Get-Items (Get-PropertyValue $ooda 'lanes'))) {
        Add-Paragraph $document "$(As-Text (Get-PropertyValue $lane 'subtitle'))（$(As-Text (Get-PropertyValue $lane 'title'))）" $wdStyleHeading2
        foreach ($node in (Get-Items (Get-PropertyValue $lane 'nodes'))) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'title'))：输入 $(As-Text (Get-PropertyValue $node 'input'))；输出 $(As-Text (Get-PropertyValue $node 'output'))；耗时 $(As-Text (Get-PropertyValue $node 'duration'))；规则 $(As-Text (Get-PropertyValue $node 'rule'))"
        }
    }

    Add-Paragraph $document '自动想定' $wdStyleHeading1
    if ($null -eq $scenario) {
        Add-Paragraph $document '尚未生成自动想定。'
    }
    else {
        Add-Paragraph $document "想定编号：$(As-Text (Get-PropertyValue $scenario 'id'))"
        $deploymentData = Get-PropertyValue $scenario 'deploymentData'
        $scenarioEntities = @(Get-Items (Get-PropertyValue $deploymentData 'entities'))
        $scenarioTimeline = @(Get-Items (Get-PropertyValue $deploymentData 'timeline'))
        Add-Paragraph $document "实体数量：$($scenarioEntities.Count)"
        Add-Paragraph $document "事件数量：$($scenarioTimeline.Count)"
    }

    Add-Paragraph $document '部署图桥接' $wdStyleHeading1
    Add-Paragraph $document "当前状态：$(As-Text (Get-PropertyValue $bridge 'status') '未配置')"
    Add-Paragraph $document "目标地址：$(As-Text (Get-PropertyValue $bridge 'targetUrl') '未配置')"
    Add-Paragraph $document "同步想定：$(As-Text (Get-PropertyValue $bridge 'scenarioId') '尚未生成')"

    Add-Paragraph $document '设计验证' $wdStyleHeading1
    if ($null -eq $validation) {
        Add-Paragraph $document '尚未运行设计验证。'
    }
    else {
        $scoreRows = @()
        foreach ($score in (Get-Items (Get-PropertyValue $validation 'scores'))) {
            $scoreRows += ,@((As-Text (Get-PropertyValue $score 'label')), (As-Text (Get-PropertyValue $score 'score')))
        }
        Add-Table $document @('评分项', '得分') $scoreRows
        $issues = @(Get-Items (Get-PropertyValue $validation 'issues') | ForEach-Object {
            "[$(As-Text (Get-PropertyValue $_ 'level'))] $(As-Text (Get-PropertyValue $_ 'title'))：$(As-Text (Get-PropertyValue $_ 'text'))"
        })
        Add-ListSection $document '待处理问题' $issues
        $review = Get-PropertyValue $validation 'redTeamReview'
        if ($null -ne $review) {
            Add-Paragraph $document '红方审阅' $wdStyleHeading2
            Add-Paragraph $document "审阅摘要：$(As-Text (Get-PropertyValue $review 'summary'))"
            foreach ($finding in (Get-Items (Get-PropertyValue $review 'findings'))) {
                Add-Paragraph $document "[$(As-Text (Get-PropertyValue $finding 'severity'))] $(As-Text (Get-PropertyValue $finding 'title'))：$(As-Text (Get-PropertyValue $finding 'analysis'))"
                Add-Paragraph $document "建议：$(As-Text (Get-PropertyValue $finding 'recommendation'))"
            }
        }
    }

    Add-Paragraph $document '验证成熟度' $wdStyleHeading1
    Add-Paragraph $document "当前结论：$(As-Text (Get-PropertyValue $maturity 'label') '待完善')（$(As-Text (Get-PropertyValue $maturity 'readyCount') '0')/$(As-Text (Get-PropertyValue $maturity 'totalCount') '0') 项已满足）"
    foreach ($check in (Get-Items (Get-PropertyValue $maturity 'checks'))) {
        Add-Paragraph $document "[$(As-Text (Get-PropertyValue $check 'statusLabel'))] $(As-Text (Get-PropertyValue $check 'label'))：$(As-Text (Get-PropertyValue $check 'detail'))"
    }

    Add-Paragraph $document '知识依据' $wdStyleHeading1
    if ($null -eq $knowledge) {
        Add-Paragraph $document '尚未连接 Obs 知识库。'
    }
    else {
        Add-Paragraph $document "知识库：$(As-Text (Get-PropertyValue $knowledge 'name'))"
        $evidence = Get-PropertyValue $knowledge 'evidence'
        foreach ($entry in (Get-Items (Get-PropertyValue $evidence 'entries'))) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $entry 'title'))：$(As-Text (Get-PropertyValue $entry 'summary'))"
        }
        $unresolvedTerms = @(Get-Items (Get-PropertyValue $evidence 'unresolvedTerms'))
        if ($unresolvedTerms.Count) {
            Add-Paragraph $document "待补充证据：$($unresolvedTerms -join '、')"
        }
    }

    Add-Paragraph $document '概念引用' $wdStyleHeading1
    foreach ($citation in (Get-Items (Get-PropertyValue $project 'citations'))) {
        Add-Paragraph $document "$(As-Text (Get-PropertyValue $citation 'title'))：$(As-Text (Get-PropertyValue $citation 'text'))（$(As-Text (Get-PropertyValue $citation 'ref'))）"
    }

    Update-DocumentFields -Document $document
    if ($OutputFormat -eq 'pdf') {
        Export-WordPdf -Document $document -OutputPath $OutputPath | Out-Null
    }
    else {
        Save-WordDocument -Document $document -OutputPath $OutputPath | Out-Null
    }
}
finally {
    Close-WordAutomation -Word $word -Document $document
}
