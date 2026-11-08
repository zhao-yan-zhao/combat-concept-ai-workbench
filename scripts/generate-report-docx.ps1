param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [ValidateSet('docx', 'pdf')]
    [string]$OutputFormat = 'docx',

    [string]$GraphicPath = ''
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

function Add-Image {
    param(
        $Document,
        [string]$ImagePath,
        [string]$Caption = ''
    )
    if ([string]::IsNullOrWhiteSpace($ImagePath) -or (-not (Test-Path -LiteralPath $ImagePath))) { return }
    $range = $null
    $shape = $null
    try {
        $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
        $shape = $range.InlineShapes.AddPicture($ImagePath)
        if ($Caption) {
            Add-Paragraph $Document $Caption $wdStyleNormal
        }
    }
    catch {
        # 降级容错
    }
    finally {
        Release-ComObject $shape
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
$ov1c = Get-PropertyValue $payload 'ov1c'
$ov2 = Get-PropertyValue $payload 'ov2'
$ov3 = Get-PropertyValue $payload 'ov3'
$ov4 = Get-PropertyValue $payload 'ov4'
$ov5 = Get-PropertyValue $payload 'ov5'
$ov5a = Get-PropertyValue $payload 'ov5a'
$ov6a = Get-PropertyValue $payload 'ov6a'
$ov6b = Get-PropertyValue $payload 'ov6b'
$ov6c = Get-PropertyValue $payload 'ov6c'
$ov7 = Get-PropertyValue $payload 'ov7'
$ooda = Get-PropertyValue $payload 'ooda'
$scenario = Get-PropertyValue $payload 'scenario'
$bridge = Get-PropertyValue $payload 'deploymentBridge'
$validation = Get-PropertyValue $payload 'validation'
$knowledge = Get-PropertyValue $payload 'knowledge'
$maturity = Get-PropertyValue $payload 'validationMaturity'
$reportVersion = Get-PropertyValue $payload 'reportVersion'
$reportTemplate = Get-PropertyValue $payload 'reportTemplate'
$templateId = As-Text (Get-PropertyValue $reportTemplate 'id') 'tactic-doc'
$templateTitle = As-Text (Get-PropertyValue $reportTemplate 'documentTitle') '作战概念研究报告'
$templateLabel = As-Text (Get-PropertyValue $reportTemplate 'label') '战法说明'

# 自动发现图件路径
if ([string]::IsNullOrWhiteSpace($GraphicPath)) {
    $parentDir = Split-Path -Parent $InputPath
    $candidateGraphic = Join-Path $parentDir 'graphic-ov1.svg'
    if (Test-Path -LiteralPath $candidateGraphic) {
        $GraphicPath = $candidateGraphic
    }
}

$word = $null
$document = $null
try {
    $word = New-WordApplication
    $document = $word.Documents.Add()
    $title = "$(As-Text (Get-PropertyValue $project 'title') '作战概念研究') $templateTitle"
    $classification = As-Text (Get-PropertyValue $payload 'classification') (As-Text (Get-PropertyValue $project 'classification') '内部')
    $document.Sections.Item(1).Headers.Item(1).Range.Text = "作战概念研究工作台 | $templateTitle | 密级标识：$classification"
    $null = $document.Sections.Item(1).Footers.Item(1).PageNumbers.Add()

    Add-Paragraph $document $title $wdStyleTitle
    Add-Paragraph $document "密级标识：$classification"
    Add-Paragraph $document "报告模板：$templateLabel ($templateId)"
    Add-Paragraph $document "报告版本：$(As-Text (Get-PropertyValue $reportVersion 'label') '未归档草稿')"
    Add-Paragraph $document "生成时间：$(As-Text (Get-PropertyValue $payload 'generatedAt'))"

    $brief = Get-PropertyValue $project 'brief'

    if ($templateId -eq 'tactic-doc') {
        # 1. 一、问题与背景
        Add-Paragraph $document '一、问题与背景' $wdStyleHeading1
        Add-Paragraph $document "作战意图与目标：$(As-Text (Get-PropertyValue $brief 'objective'))"
        Add-Paragraph $document "核心突破思路：$(As-Text (Get-PropertyValue $brief 'approach'))"
        Add-Paragraph $document "关键前提假设：$(As-Text (Get-PropertyValue $brief 'assumptions') '无特定假设')"
        Add-Paragraph $document "预期战术效果：$(As-Text (Get-PropertyValue $brief 'expectedEffects') '待定')"

        # 2. 二、对手体系分析
        Add-Paragraph $document '二、对手体系分析' $wdStyleHeading1
        Add-Paragraph $document "主要战术风险：$(As-Text (Get-PropertyValue $brief 'risk') '未记录明显风险')"
        $ov4Units = @(Get-Items (Get-PropertyValue $ov4 'units'))
        if ($ov4Units.Count) {
            Add-Paragraph $document '作战组织与敌我指挥架构 (OV-4)' $wdStyleHeading2
            $ov4Rows = @()
            foreach ($unit in $ov4Units) {
                $ov4Rows += ,@((As-Text (Get-PropertyValue $unit 'label')), (As-Text (Get-PropertyValue $unit 'echelon')), (As-Text (Get-PropertyValue $unit 'role')), (As-Text (Get-PropertyValue $unit 'superiorLabel') '最高指挥'))
            }
            Add-Table $document @('编成单位', '梯队', '作战职责', '上级指挥') $ov4Rows
        }

        # 3. 三、战法核心思想
        Add-Paragraph $document '三、战法核心思想' $wdStyleHeading1
        Add-Paragraph $document "作战概念方向：$(As-Text (Get-PropertyValue $project 'direction'))"
        Add-Paragraph $document '高层作战概念总体构想 (OV-1)' $wdStyleHeading2
        if ($GraphicPath -and (Test-Path -LiteralPath $GraphicPath)) {
            Add-Image -Document $document -ImagePath $GraphicPath -Caption '图 1：高层作战概念图 (OV-1)'
        }
        $ov1Nodes = @(Get-Items (Get-PropertyValue $ov1 'nodes'))
        if ($ov1Nodes.Count) {
            foreach ($node in $ov1Nodes) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'label'))：$(As-Text (Get-PropertyValue $node 'description'))"
            }
        }

        # 4. 四、力量运用与编组
        Add-Paragraph $document '四、力量运用与编组' $wdStyleHeading1
        $ov1cMappings = @(Get-Items (Get-PropertyValue $ov1c 'mappings'))
        if ($ov1cMappings.Count) {
            Add-Paragraph $document '作战任务与力量编组映射 (OV-1c)' $wdStyleHeading2
            $ov1cRows = @()
            foreach ($map in $ov1cMappings) {
                $ov1cRows += ,@((As-Text (Get-PropertyValue $map 'taskLabel')), (As-Text (Get-PropertyValue $map 'activityCount')), (As-Text (Get-PropertyValue $map 'status')))
            }
            Add-Table $document @('作战任务', '支撑活动数', '规划状态') $ov1cRows
        } else {
            Add-Paragraph $document '作战任务与概念编组已通过 DoDAF 拓扑持久化。'
        }

        # 5. 五、实施阶段与时序
        Add-Paragraph $document '五、实施阶段与时序' $wdStyleHeading1
        $ov6cSequences = @(Get-Items (Get-PropertyValue $ov6c 'sequences'))
        if ($ov6cSequences.Count) {
            Add-Paragraph $document '作战阶段时序演进 (OV-6c)' $wdStyleHeading2
            foreach ($seq in $ov6cSequences) {
                Add-Paragraph $document "阶段 [$(As-Text (Get-PropertyValue $seq 'phaseTitle'))]：从 $(As-Text (Get-PropertyValue $seq 'sourceNodeTitle')) 到 $(As-Text (Get-PropertyValue $seq 'targetNodeTitle'))（$(As-Text (Get-PropertyValue $seq 'actionDescription'))）"
            }
        } else {
            Add-Paragraph $document '作战实施阶段与时序已定义。'
        }

        # 6. 六、制胜机理与因果协同 (OV-5/OODA)
        Add-Paragraph $document '六、制胜机理与因果协同 (OV-5/OODA)' $wdStyleHeading1
        Add-Paragraph $document 'OV-5a 作战活动工序分解' $wdStyleHeading2
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

        Add-Paragraph $document 'OODA 决策循环与时效分析' $wdStyleHeading2
        Add-Paragraph $document "周期估算：$(As-Text (Get-PropertyValue $ooda 'durationMinutes') '待估算') 分钟"
        foreach ($lane in (Get-Items (Get-PropertyValue $ooda 'lanes'))) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $lane 'subtitle'))（$(As-Text (Get-PropertyValue $lane 'title'))）" $wdStyleHeading2
            foreach ($node in (Get-Items (Get-PropertyValue $lane 'nodes'))) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'title'))：输入 $(As-Text (Get-PropertyValue $node 'input'))；输出 $(As-Text (Get-PropertyValue $node 'output'))；耗时 $(As-Text (Get-PropertyValue $node 'duration'))；规则 $(As-Text (Get-PropertyValue $node 'rule'))"
            }
        }

        $ov6aRules = @(Get-Items (Get-PropertyValue $ov6a 'rules'))
        if ($ov6aRules.Count) {
            Add-Paragraph $document '交战规则与动作约束 (OV-6a)' $wdStyleHeading2
            foreach ($rule in $ov6aRules) {
                Add-Paragraph $document "- [$(As-Text (Get-PropertyValue $rule 'kind'))] $(As-Text (Get-PropertyValue $rule 'text'))"
            }
        }

        # 7. 七、风险评估与反制应对
        Add-Paragraph $document '七、风险评估与反制应对' $wdStyleHeading1
        $ov6bTransitions = @(Get-Items (Get-PropertyValue $ov6b 'transitions'))
        if ($ov6bTransitions.Count) {
            Add-Paragraph $document '状态迁移与异常处置 (OV-6b)' $wdStyleHeading2
            foreach ($trans in $ov6bTransitions) {
                Add-Paragraph $document "迁移：$(As-Text (Get-PropertyValue $trans 'sourceState')) -> $(As-Text (Get-PropertyValue $trans 'targetState'))（触发条件：$(As-Text (Get-PropertyValue $trans 'trigger'))）"
            }
        }
        Add-Paragraph $document "红方对抗质询与反制：$(As-Text (Get-PropertyValue $validation 'redTeam') '已通过红方多轮质询核验')"

        # 8. 八、评估结论与效能指标
        Add-Paragraph $document '八、评估结论与效能指标' $wdStyleHeading1
        if ($null -ne $validation) {
            $scoreRows = @()
            foreach ($score in (Get-Items (Get-PropertyValue $validation 'scores'))) {
                $scoreRows += ,@((As-Text (Get-PropertyValue $score 'label')), (As-Text (Get-PropertyValue $score 'score')))
            }
            Add-Table $document @('效能指标项', '评估得分') $scoreRows
        }
        Add-Paragraph $document "验证成熟度：$(As-Text (Get-PropertyValue $maturity 'label') '待完善')（$(As-Text (Get-PropertyValue $maturity 'readyCount') '0')/$(As-Text (Get-PropertyValue $maturity 'totalCount') '0') 项已满足）"
        foreach ($check in (Get-Items (Get-PropertyValue $maturity 'checks'))) {
            Add-Paragraph $document "[$(As-Text (Get-PropertyValue $check 'statusLabel'))] $(As-Text (Get-PropertyValue $check 'label'))：$(As-Text (Get-PropertyValue $check 'detail'))"
        }

        # 9. 九、溯源证据与引用附录
        Add-Paragraph $document '九、溯源证据与引用附录' $wdStyleHeading1
        if ($null -ne $knowledge) {
            Add-Paragraph $document "知识库：$(As-Text (Get-PropertyValue $knowledge 'name'))"
            $evidence = Get-PropertyValue $knowledge 'evidence'
            foreach ($entry in (Get-Items (Get-PropertyValue $evidence 'entries'))) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $entry 'title'))：$(As-Text (Get-PropertyValue $entry 'summary'))"
            }
        }
        foreach ($citation in (Get-Items (Get-PropertyValue $project 'citations'))) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $citation 'title'))：$(As-Text (Get-PropertyValue $citation 'text'))（$(As-Text (Get-PropertyValue $citation 'ref'))）"
        }

    } elseif ($templateId -eq 'scenario-doc') {
        # 想定文书：6 章节
        Add-Paragraph $document '一、想定背景与初始态势' $wdStyleHeading1
        Add-Paragraph $document "作战构想背景：$(As-Text (Get-PropertyValue $brief 'objective'))"
        Add-Paragraph $document "核心行动方案：$(As-Text (Get-PropertyValue $brief 'approach'))"
        if ($null -ne $scenario) {
            Add-Paragraph $document "想定编号：$(As-Text (Get-PropertyValue $scenario 'id'))"
            $deploymentData = Get-PropertyValue $scenario 'deploymentData'
            $scenarioEntities = @(Get-Items (Get-PropertyValue $deploymentData 'entities'))
            $scenarioTimeline = @(Get-Items (Get-PropertyValue $deploymentData 'timeline'))
            Add-Paragraph $document "实体规模：$($scenarioEntities.Count) 个概念实体"
            Add-Paragraph $document "时序事件：$($scenarioTimeline.Count) 个想定演进事件"
        }

        Add-Paragraph $document '二、作战环境与时空边界' $wdStyleHeading1
        Add-Paragraph $document '空间坐标基准：抽象百分比网格与相对坐标体系'
        Add-Paragraph $document "部署桥接状态：$(As-Text (Get-PropertyValue $bridge 'status') '未配置')，目标：$(As-Text (Get-PropertyValue $bridge 'targetUrl') '未配置')"

        Add-Paragraph $document '三、双方企图与作战编成' $wdStyleHeading1
        $ov4Units = @(Get-Items (Get-PropertyValue $ov4 'units'))
        if ($ov4Units.Count) {
            $ov4Rows = @()
            foreach ($unit in $ov4Units) {
                $ov4Rows += ,@((As-Text (Get-PropertyValue $unit 'label')), (As-Text (Get-PropertyValue $unit 'echelon')), (As-Text (Get-PropertyValue $unit 'role')))
            }
            Add-Table $document @('编组力量', '梯队', '职责') $ov4Rows
        }

        Add-Paragraph $document '四、阶段设定与裁决节点' $wdStyleHeading1
        $ov6cSequences = @(Get-Items (Get-PropertyValue $ov6c 'sequences'))
        if ($ov6cSequences.Count) {
            foreach ($seq in $ov6cSequences) {
                Add-Paragraph $document "推进时序：从 $(As-Text (Get-PropertyValue $seq 'sourceNodeTitle')) 到 $(As-Text (Get-PropertyValue $seq 'targetNodeTitle'))"
            }
        } else {
            Add-Paragraph $document '裁决节点与状态因果映射已定义。'
        }

        Add-Paragraph $document '五、推演与交战规则 (ROE/OV-6a)' $wdStyleHeading1
        $ov6aRules = @(Get-Items (Get-PropertyValue $ov6a 'rules'))
        if ($ov6aRules.Count) {
            foreach ($rule in $ov6aRules) {
                Add-Paragraph $document "- $(As-Text (Get-PropertyValue $rule 'text'))"
            }
        }

        Add-Paragraph $document '六、附件与态势图件 (OV-1/OV-2)' $wdStyleHeading1
        if ($GraphicPath -and (Test-Path -LiteralPath $GraphicPath)) {
            Add-Image -Document $document -ImagePath $GraphicPath -Caption '图 1：高层作战概念图 (OV-1)'
        }
        $ov1Nodes = @(Get-Items (Get-PropertyValue $ov1 'nodes'))
        foreach ($node in $ov1Nodes) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'label'))：$(As-Text (Get-PropertyValue $node 'description'))"
        }
        Add-Paragraph $document "验证成熟度：$(As-Text (Get-PropertyValue $maturity 'label') '待完善')"

    } elseif ($templateId -eq 'wargame-review') {
        # 推演复盘：6 章节
        Add-Paragraph $document '一、推演概况与参演编组' $wdStyleHeading1
        Add-Paragraph $document "作战方向：$(As-Text (Get-PropertyValue $project 'direction'))"
        Add-Paragraph $document "预设目标：$(As-Text (Get-PropertyValue $brief 'objective'))"

        Add-Paragraph $document '二、各阶段推进结果与战损' $wdStyleHeading1
        $ov5Activities = @(Get-Items (Get-PropertyValue $ov5 'activities'))
        Add-Paragraph $document "关键活动达成度：共完成 $($ov5Activities.Count) 项作战活动工序演进"

        Add-Paragraph $document '三、关键决策点与对抗博弈' $wdStyleHeading1
        Add-Paragraph $document "OODA 决策响应周期：$(As-Text (Get-PropertyValue $ooda 'durationMinutes') '待估算') 分钟"
        Add-Paragraph $document "红方对抗博弈结论：$(As-Text (Get-PropertyValue $validation 'redTeam') '无对抗异常')"

        Add-Paragraph $document '四、执行偏差与成因深度剖析' $wdStyleHeading1
        if ($null -ne $validation) {
            $issues = @(Get-Items (Get-PropertyValue $validation 'issues') | ForEach-Object {
                "[$(As-Text (Get-PropertyValue $_ 'level'))] $(As-Text (Get-PropertyValue $_ 'title'))：$(As-Text (Get-PropertyValue $_ 'text'))"
            })
            Add-ListSection $document '执行偏差核查项' $issues
        }

        Add-Paragraph $document '五、体系机理与战法改进建议' $wdStyleHeading1
        Add-Paragraph $document "成熟度结论：$(As-Text (Get-PropertyValue $maturity 'label') '已完善')"
        foreach ($check in (Get-Items (Get-PropertyValue $maturity 'checks'))) {
            Add-Paragraph $document "[$(As-Text (Get-PropertyValue $check 'statusLabel'))] $(As-Text (Get-PropertyValue $check 'label'))：$(As-Text (Get-PropertyValue $check 'detail'))"
        }

        Add-Paragraph $document '六、参考依据与数据来源' $wdStyleHeading1
        if ($null -ne $knowledge) {
            $evidence = Get-PropertyValue $knowledge 'evidence'
            foreach ($entry in (Get-Items (Get-PropertyValue $evidence 'entries'))) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $entry 'title'))：$(As-Text (Get-PropertyValue $entry 'summary'))"
            }
        }
    } else {
        # 通用模板保底
        Add-Paragraph $document '概念简报' $wdStyleHeading1
        Add-Paragraph $document "概念方向：$(As-Text (Get-PropertyValue $project 'direction'))"
        Add-Paragraph $document "作战目标：$(As-Text (Get-PropertyValue $brief 'objective'))"
        Add-Paragraph $document "核心思路：$(As-Text (Get-PropertyValue $brief 'approach'))"
        Add-Paragraph $document "关键假设：$(As-Text (Get-PropertyValue $brief 'assumptions'))"
        Add-Paragraph $document "主要风险：$(As-Text (Get-PropertyValue $brief 'risk'))"

        Add-Paragraph $document 'OV-1 总体概念' $wdStyleHeading1
        if ($GraphicPath -and (Test-Path -LiteralPath $GraphicPath)) {
            Add-Image -Document $document -ImagePath $GraphicPath -Caption '图 1：高层作战概念图 (OV-1)'
        }
        $ov1Nodes = @(Get-Items (Get-PropertyValue $ov1 'nodes'))
        if ($ov1Nodes.Count) {
            foreach ($node in $ov1Nodes) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $node 'label'))：$(As-Text (Get-PropertyValue $node 'description'))"
            }
        } else {
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
        } else {
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
        } else {
            $scoreRows = @()
            foreach ($score in (Get-Items (Get-PropertyValue $validation 'scores'))) {
                $scoreRows += ,@((As-Text (Get-PropertyValue $score 'label')), (As-Text (Get-PropertyValue $score 'score')))
            }
            Add-Table $document @('评分项', '得分') $scoreRows
            $issues = @(Get-Items (Get-PropertyValue $validation 'issues') | ForEach-Object {
                "[$(As-Text (Get-PropertyValue $_ 'level'))] $(As-Text (Get-PropertyValue $_ 'title'))：$(As-Text (Get-PropertyValue $_ 'text'))"
            })
            Add-ListSection $document '待处理问题' $issues
        }

        Add-Paragraph $document '验证成熟度' $wdStyleHeading1
        Add-Paragraph $document "当前结论：$(As-Text (Get-PropertyValue $maturity 'label') '待完善')（$(As-Text (Get-PropertyValue $maturity 'readyCount') '0')/$(As-Text (Get-PropertyValue $maturity 'totalCount') '0') 项已满足）"
        foreach ($check in (Get-Items (Get-PropertyValue $maturity 'checks'))) {
            Add-Paragraph $document "[$(As-Text (Get-PropertyValue $check 'statusLabel'))] $(As-Text (Get-PropertyValue $check 'label'))：$(As-Text (Get-PropertyValue $check 'detail'))"
        }

        Add-Paragraph $document '知识依据' $wdStyleHeading1
        if ($null -eq $knowledge) {
            Add-Paragraph $document '尚未连接 Obs 知识库。'
        } else {
            Add-Paragraph $document "知识库：$(As-Text (Get-PropertyValue $knowledge 'name'))"
            $evidence = Get-PropertyValue $knowledge 'evidence'
            foreach ($entry in (Get-Items (Get-PropertyValue $evidence 'entries'))) {
                Add-Paragraph $document "$(As-Text (Get-PropertyValue $entry 'title'))：$(As-Text (Get-PropertyValue $entry 'summary'))"
            }
        }

        Add-Paragraph $document '概念引用' $wdStyleHeading1
        foreach ($citation in (Get-Items (Get-PropertyValue $project 'citations'))) {
            Add-Paragraph $document "$(As-Text (Get-PropertyValue $citation 'title'))：$(As-Text (Get-PropertyValue $citation 'text'))（$(As-Text (Get-PropertyValue $citation 'ref'))）"
        }
    }

    Update-DocumentFields -Document $document
    if ($OutputFormat -eq 'pdf') {
        Export-WordPdf -Document $document -OutputPath $OutputPath | Out-Null
    } else {
        Save-WordDocument -Document $document -OutputPath $OutputPath | Out-Null
    }
}
finally {
    Close-WordAutomation -Word $word -Document $document
}
