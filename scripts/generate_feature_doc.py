# -*- coding: utf-8 -*-
"""
生成《作战概念研究工作台项目功能说明书》Word (.docx) 文档
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, color_hex):
    """设置单元格背景颜色"""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """设置单元格内边距 (单位: dxa, 1 pt = 20 dxa)"""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    """为表格添加精致边框"""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def add_callout(doc, text, title=""):
    """添加提示高亮框"""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "F0F7FF")
    set_cell_margins(cell, top=160, bottom=160, left=220, right=200)
    
    # 边框: 仅左侧粗边框
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="1F4E79"/>'
        f'<w:top w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.2
    
    if title:
        run_title = p.add_run(f"【{title}】\n")
        run_title.font.name = "Microsoft YaHei"
        run_title.font.size = Pt(10.5)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
        run_title._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
        
    run_txt = p.add_run(text)
    run_txt.font.name = "Microsoft YaHei"
    run_txt.font.size = Pt(9.5)
    run_txt.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    run_txt._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
    
    # 段后加一点空隙
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, headers, data, header_bg="1F4E79"):
    """构建专业样式的表格"""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)
    
    # 确保至少有一行作为表头
    if len(table.rows) == 0:
        hdr_row = table.add_row()
    else:
        hdr_row = table.rows[0]
        
    hdr_cells = hdr_row.cells
    for i, header_text in enumerate(headers):
        hdr_cells[i].text = header_text
        set_cell_background(hdr_cells[i], header_bg)
        set_cell_margins(hdr_cells[i], top=140, bottom=140, left=140, right=140)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        for run in p.runs:
            run.font.name = "Microsoft YaHei"
            run.font.size = Pt(10)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
            
    # 数据行
    for r_idx, row_data in enumerate(data):
        row_cells = table.add_row().cells
        bg_color = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            row_cells[c_idx].text = str(val)
            set_cell_background(row_cells[c_idx], bg_color)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=120, right=120)
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            for run in p.runs:
                run.font.name = "Microsoft YaHei"
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
                run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

    # 设置列宽
    for row in table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = Inches(width)

def build_document(output_path):
    doc = docx.Document()
    
    # 设置页边距
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
    # 设置基础正文字体
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Microsoft YaHei'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    style_normal.paragraph_format.line_spacing = 1.25
    style_normal.paragraph_format.space_after = Pt(6)
    style_normal._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

    # ---------------- 封面 / 标题区 ----------------
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(24)
    title_p.paragraph_format.space_after = Pt(8)
    run_t = title_p.add_run("作战概念研究工作台\n系统功能说明书")
    run_t.font.name = "Microsoft YaHei"
    run_t.font.size = Pt(24)
    run_t.font.bold = True
    run_t.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    run_t._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_p.paragraph_format.space_after = Pt(20)
    run_sub = sub_p.add_run("Combat Concept AI Workbench · 功能架构与业务规范手册")
    run_sub.font.name = "Microsoft YaHei"
    run_sub.font.size = Pt(12)
    run_sub.font.color.rgb = RGBColor(0x55, 0x66, 0x77)
    run_sub._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

    # 元数据信息表格
    meta_table = doc.add_table(rows=0, cols=2)
    meta_data = [
        ("系统定位", "内网作战概念研究、DoDAF 派生架构设计与推演想定孵化平台"),
        ("当前基线", "v0.67 原型稳定基线（七步主线架构 + 关联模型拓扑）"),
        ("服务地址", "工作台根入口：http://127.0.0.1:8792/ | 概念图标绘工具：http://127.0.0.1:8765/"),
        ("编制日期", "2026年10月"),
        ("核心技术", "Node.js 22+ (原生 SQLite) / Web 原生响应式架构 / OpenAI 兼容服务 / python-docx")
    ]
    format_table(meta_table, [1.5, 5.0], ["属性", "说明"], meta_data, header_bg="2B6CB0")
    
    doc.add_page_break()

    # ---------------- 章节标题生成辅助 ----------------
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Microsoft YaHei"
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Microsoft YaHei"
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0x2B, 0x6C, 0xB0)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Microsoft YaHei"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
        return p

    # ---------------- 第一章：系统定位与设计理念 ----------------
    add_h1("一、系统定位与设计理念")
    
    add_h2("1.1 系统背景与设计初衷")
    doc.add_paragraph(
        "“作战概念研究工作台”（Combat Concept AI Workbench）是一套面向军事分析人员、作战概念研究人员与想定规划人员的专业级研究辅助平台。系统旨在解决传统作战概念论证周期长、文本与架构模型脱节、态势标绘手工重复、逻辑一致性难以闭环验证等核心痛点。"
    )
    doc.add_paragraph(
        "平台并非普通对话式 AI 工具，而是以“严格研究工作流”为轴心，将研究人员模糊、碎片的作战灵感，逐步转化为符合 DoDAF 2.02 / DM2 体系规范的高层概念模型，并最终自动实例化为可推演、可审查的抽象想定与验证方案。"
    )

    add_h2("1.2 五大核心设计理念")
    add_callout(doc, 
        "1. 灵感到想定，一气呵成：从一句话灵感发散起步，AI 负责追问、建模、补全与推导，人工负责引导、甄选、复核与微调。\n"
        "2. 多视图协同，逐级具象：建立从“总体概念 -> 作战阶段 -> 作战任务 -> 兵力编组 -> 概念图空间布局 -> 仿真演示”的自顶向下演进链。\n"
        "3. 知识原生驱动：深度对接 Obsidian 知识库与 CMO 装备库，使装备参数、历史战例、条令规范直接融入生成与校验。\n"
        "4. 资产无缝衔接：不推翻既有标绘与仿真工具，通过标准化数据流向（GeoJSON/mapInput）实现与外部标绘软件双向桥接。\n"
        "5. 验证前置与红方对抗：在设计阶段即介入活动逻辑死锁检查、OODA周期分析与AI红方反制，早暴露问题，减少仿真返工。",
        "工作台核心设计哲学"
    )

    add_h2("1.3 技术架构与组件分工")
    doc.add_paragraph(
        "工作台采用简洁、高内聚、易于内网独立部署的技术选型："
    )
    
    arch_table = doc.add_table(rows=0, cols=3)
    arch_data = [
        ("Web 前端\n(Design Studio)", "原生现代化 ES 模块构建，集成画布拖拽、左侧七步主流程轨道、实时关联模型拓扑展开、上下文属性面板与知识抽屉。", "浏览器端无状态轻量化交互，毫秒级响应"),
        ("服务端 Runtime\n(Node.js 服务)", "采用 Node.js 原生 SQLite 引擎进行模型存储与审计追溯；管理 AI 提示词路由、知识库混合检索、Office 导出与数据版本化治理。", "默认端口 8792\n提供 RESTful 接口与状态机"),
        ("外部概念图标绘工具\n(Combat Map)", "独立进程运行的轻量空间标绘服务（8765 端口），承载兵力部署空间化、阶段作战要素标绘，通过 iframe 与 postMessage 桥接工作台。", "默认端口 8765\n双向数据同步与批次锁定"),
        ("AI 认知驱动层\n(AI Client)", "支持 OpenAI 兼容 API、内网大模型服务以及本地启发式降级规则。所有 API 密钥严格保存在进程内存，不落盘、不入库。", "多模型适配、提示词透明化治理")
    ]
    format_table(arch_table, [1.5, 3.5, 1.5], ["组件名称", "核心职责与实现机制", "运行特征"], arch_data)

    # ---------------- 第二章：核心业务主线流程（七步主线） ----------------
    add_h1("二、核心业务主线流程（七步主线）")
    doc.add_paragraph(
        "工作台严格遵循“主线驱动、逐级具象、门禁控制”的研究范式。左侧流程轨道固定由七大权威主线步骤构成，每一步骤均具备明确的权威数据产物与阶段确认门禁："
    )

    mainline_table = doc.add_table(rows=0, cols=5)
    mainline_data = [
        ("01 简报", "brief", "概念简报", "研究意图、目标、路线、假设、预期效果、风险、证据", "简报六要素齐全且无待补充项"),
        ("02 阶段行动", "phase-action", "阶段与行动", "作战聚焦、作战阶段时序链、红蓝双方行动、准入准出条件", "阶段划分与双方行动已人工确认"),
        ("03 作战任务", "operational-task", "作战任务", "作战任务清单、阵营分配、任务类型、行动区域、目标与效果", "作战任务清单已人工确认"),
        ("04 作战兵力", "force-mission", "作战兵力", "兵力编组（编队/平台/载荷）、任务承接矩阵、CMO装备引用", "兵力与任务承接关系已人工确认"),
        ("05 总体图", "ov1", "总体图(OV1a)", "高层作战构想、核心节点、关键流动（信息/控制/打击/保障）", "总体节点关系完整闭环并已确认"),
        ("06 概念图", "concept-map", "概念图", "兵力与阶段要素的空间相对布局表达、外部标绘图层", "外部概念图研究参考已冻结确认"),
        ("07 仿真演示", "scenario", "仿真演示", "百分比网格想定、推演时序时间线、仿真输入包指纹、验证结论", "最终成果校核，支持归档与导出")
    ]
    format_table(mainline_table, [0.9, 1.0, 1.1, 2.3, 1.2], ["步骤", "资源键", "显示名称", "核心产物内容", "门禁准出要求"], mainline_data)

    add_h2("2.1 步骤 01：概念简报（Brief）与多轮灵感孵化")
    doc.add_paragraph(
        "概念简报是作战研究的逻辑源头。系统通过多轮交互将用户的零散直觉转化为严谨的六要素研究简报："
    )
    doc.add_paragraph(
        "• 六维灵感追问：AI 围绕作战环境、对手能力、己方资源、约束条件、成功标准与核心构想展开多轮有界追问。\n"
        "• 概念方向提案卡片：AI 结合问题背景自动发散并生成 2~3 组对比方向（如：电子压制主导型、无人饱和突防型、诱饵佯动协同型），供研究员遴选。\n"
        "• 咨询助手（Research Chat）：提供并行研究咨询问答，解答条令、战例与战术机理问题，给出验证关注点，不污染简报正文。\n"
        "• 简报六要素结构化提炼：自动提取并人工确认【研究意图】、【研究目标】、【研究路线】、【关键假设】、【预期效果】与【主要风险】。"
    )

    add_h2("2.2 步骤 02：阶段与行动（Phase & Action）")
    doc.add_paragraph(
        "将抽象研究目标分解为时间维度上的时序演进过程："
    )
    doc.add_paragraph(
        "• 作战聚焦选择：AI 从简报提取 3 个聚焦候选，支持自定义新增，确保后续阶段规划紧扣核心战术目的。\n"
        "• 动态阶段划设：支持灵活划分 2~12 个作战阶段（如：隐蔽机动与阵地展开、多源侦察与电磁压制、联合打击与毁伤评估、撤离重组等）。\n"
        "• 红蓝对抗行动链：每个阶段内细化蓝方反制行动与红方战术行动，明确阶段进入条件与达成退出准则。"
    )

    add_h2("2.3 步骤 03：作战任务（Operational Task）")
    doc.add_paragraph(
        "将宏观行动具象化为战役战术级任务指令："
    )
    doc.add_paragraph(
        "• 任务要素完备化：配置任务阵营（红/蓝/中立）、任务类型（侦察预警/指挥控制/防空拦截/对海突击/电子干扰等）、目标区域及预期达成效果。\n"
        "• 时序依赖与协同关系：梳理任务前置依赖与并行协同逻辑，为下游兵力编配建立明确的任务载荷需求。"
    )

    add_h2("2.4 步骤 04：作战兵力与任务承接（Force & Mission）")
    doc.add_paragraph(
        "解决“由谁去打、用什么装备打、谁负责哪个任务”的落地映射："
    )
    doc.add_paragraph(
        "• 兵力编组配置：构建编队-单元-作战平台层级，配置平台数量、主要载荷与战术通信属性。\n"
        "• 任务承接矩阵：建立兵力单元与作战任务的双向绑定，严密审查无兵力承接的任务或无任务闲置的兵力。\n"
        "• CMO 装备库推荐：接入现代化装备数据库，根据作战任务类型与平台性能，智能推荐匹配的舰艇、战机、无人机及弹药载荷。"
    )

    add_h2("2.5 步骤 05：总体作战概念图（OV-1a Overall Concept）")
    doc.add_paragraph(
        "高层作战构想的全局骨架与全景共识视图："
    )
    doc.add_paragraph(
        "• 核心节点生成：自动提炼红方核心兵力、蓝方关键目标、电磁环境要素、侦察感知节点、指挥中枢与火力打击节点。\n"
        "• 关键关系流闭环：构建信息流（情报/目标数据）、控制流（指挥授权/任务协同）、打击流（火力打击）与评估反馈流，杜绝断头链路与孤立节点。"
    )

    add_h2("2.6 步骤 06：作战概念图绘制（Concept Map）")
    doc.add_paragraph(
        "将逻辑拓扑向地理与空间态势投影："
    )
    doc.add_paragraph(
        "• 独立标绘工具联动：自动与 8765 端口的 Web 标绘服务协同，将已确认阶段与兵力转换为空间相对阵位。\n"
        "• 空间图层与态势标号：支持防区外发射线、雷达探测扇区、通信中继链、机动巡逻区等战术图形标绘。\n"
        "• 跨进程安全桥接：采用 iframe + postMessage 机制，每次数据交接生成独立版本批次，防止并发覆盖。"
    )

    add_h2("2.7 步骤 07：自动想定与仿真演示（Scenario & Simulation）")
    doc.add_paragraph(
        "作战概念向仿真推演的实例化交付终点："
    )
    doc.add_paragraph(
        "• 抽象网格想定生成：生成标准化百分比网格态势数据、兵力阵位与传感器/火力覆盖包线（支持 GeoJSON/mapInput 导出）。\n"
        "• 时间线推进事件序列：依据 OODA 耗时与阶段划分，生成 T+0、T+15、T+30 等事件推演序列。\n"
        "• 仿真指纹与结果校核：生成仿真输入包 SHA-256 唯一指纹，结果回传时严格校验指纹一致性，避免旧模型误判。"
    )

    # ---------------- 第三章：关联架构视图与 DoDAF 模型体系 ----------------
    add_h1("三、关联架构视图与 DoDAF 2.02 / DM2 模型矩阵")
    doc.add_paragraph(
        "为保障军事体系架构的严谨性，工作台并未将 DoDAF 产品机械堆砌在主流程中，而是采用“主线锚点挂接、按需动态展开”的拓扑设计。研究人员进入特定主线步骤时，可在左侧轨道展开关联模型视图，实现精细化编辑与校验反查："
    )

    dodaf_table = doc.add_table(rows=0, cols=4)
    dodaf_data = [
        ("OV-1b", "任务分解模型", "作战任务", "将宏观任务逐层展开为任务分组、子任务树与组内时序，梳理协同执行逻辑。"),
        ("OV-1c", "任务活动映射", "跨模型校核", "核对战术任务与 OV-5b 作战活动之间的双向映射覆盖度，标红未映射活动。"),
        ("OV-2", "作战资源流描述", "作战兵力", "刻画各作战节点（兵力编组）之间的物理资源流、弹药补给流与高层信息流。"),
        ("OV-3", "作战资源流矩阵", "作战兵力", "表格化定义节点间的信息交换接口、数据内容、交换频度、带宽要求与保密级别。"),
        ("OV-4", "作战组织关系图", "作战兵力", "展示作战编队的指挥隶属、战术协同与支援保障层级，诊断指挥关系断层。"),
        ("OV-5a", "活动层级分解树", "总体图", "采用分解清单与父子层级结构，定义战略-战役-战术活动树，不单设孤立页面。"),
        ("OV-5b", "作战活动模型", "总体图", "核心活动模型，描述侦察、决策、打击、评估等活动间的信息流、控制流与资源流。"),
        ("OV-6a", "作战规则库", "阶段 / 任务", "基于规则本体定义作战条令、交战规则（ROE）与进入准则，支持先建规则后绑活动。"),
        ("OV-6b", "状态机校验", "阶段 / 任务", "为核心作战单元建立多状态转移模型，静态检测不可达状态、死锁循环与回改阶段。"),
        ("OV-6c", "跨对象时序图", "阶段 / 兵力", "绘制平台与节点间的交互时序泳道图，自动诊断时序倒流、未排程动作与时延超标。"),
        ("OV-7", "状态活动映射", "跨模型校核", "校验状态转移事件是否由明确的 OV-5b 作战活动触发，保证状态迁移具有物理语义。"),
        ("OODA", "行为综合视角", "总体图", "按 Observe-Orient-Decide-Act 循环梳理关键闭环链路，诊断单点故障与耗时瓶颈。")
    ]
    format_table(dodaf_table, [1.0, 1.4, 1.1, 3.0], ["模型代号", "模型名称", "关联主线锚点", "功能说明与诊断能力"], dodaf_data)

    # ---------------- 第四章：专业支撑模块与核心特性 ----------------
    add_h1("四、专业支撑模块与核心特性")

    add_h2("4.1 Obsidian (Obs) 知识库深度集成")
    doc.add_paragraph(
        "工作台视知识资产为作战概念创新的第一动力，全面打通与用户本地知识库的交互："
    )
    doc.add_paragraph(
        "• 本地 Markdown/YAML 原生解析：自动解析 Vault 中的笔记标题、标签、双向链接（WikiLinks）、正文片段以及表格中的装备/编制参数。\n"
        "• 混合检索（Hybrid Search）：提供关键词匹配（Keyword）、语义向量（Vector）以及两者的加权混合检索（Hybrid），精准命中历史战例与条令。\n"
        "• 敏感片段安全过滤机制：严格执行敏感性分级，敏感 Vault 内容在 AI 请求、模型快照、报告导出与归档中自动脱敏排除，仅保留研究级引用标识。\n"
        "• 双向闭环写回：支持将已确认的简报、活动清单、OODA 节点及成果报告反向写入 Obsidian Vault 指定子目录，建立回链索引。"
    )

    add_h2("4.2 AI 设计验证与红方对抗引擎")
    doc.add_paragraph(
        "在概念设计阶段提前暴露体系脆弱点，降低推演阶段的返工成本："
    )
    doc.add_paragraph(
        "• 规则静态一致性校验：自动检查 OV-5 输入输出闭环、资源消耗超额、时钟窗口越界、状态机循环卡死、未配对接口等 10 余项结构问题。\n"
        "• AI 专家红方对抗推演：大模型切换为红方对手指挥官视角，结合条令与历史战例发起对抗性质疑，指出方案中最易被压制/切断的关键节点，并提供蓝方强化对策建议。\n"
        "• 结构核对台（Structure Review）：全局诊断仪表盘，统一展示规划覆盖率、未绑定实体、过期失效状态与断链警告，支持一键定位溯源回改。"
    )

    add_h2("4.3 成果报告与全格式导出")
    doc.add_paragraph(
        "支持全流程成果固化与多样化交付格式："
    )
    
    export_table = doc.add_table(rows=0, cols=3)
    export_data = [
        ("办公交付格式", "Word (.docx) / PDF / PPTX 汇报演示文稿 / RTF 富文本", "用于向专家组提交立项简报、研究论证报告及评审汇报"),
        ("技术与交换格式", "JSON / XML (标准 DoDAF 交换) / Markdown 文档", "用于跨系统模型同步、内网版本库归档与文档知识库沉淀"),
        ("态势标绘与空间数据", "GeoJSON 空间图层 / mapInput 标准数据包", "无缝对接外部地图标绘工具与数字化态势推演大屏"),
        ("防篡改完整性清单", "SHA-256 哈希清单校验", "导出文件随附哈希指纹，防止跨网传输或长周期流转中篡改")
    ]
    format_table(export_table, [1.5, 2.5, 2.5], ["类别", "支持格式", "应用场景与价值"], export_data)

    add_h2("4.4 内网协同审阅与版本治理")
    doc.add_paragraph(
        "• 协同身份体系：支持多角色本地/内网账号登录与身份切换，留存明确的操作审计轨迹。\n"
        "• 审阅意见与决策批注：支持按阶段提出审查批注、驳回或通过决策，并可附带至多 12 条知识依据。\n"
        "• 乐观并发与冲突预防：基于版本修订号进行冲突检测，发现远端更新时提供对比告警，防止团队覆盖彼此修改。\n"
        "• 多方案快照量化比较：支持保存不同演进分支快照，基于任务达成、风险、时序、资源等 8 项透明准则进行加权比较与敏感性分析。"
    )

    add_h2("4.5 AI 提示词与安全配置中心")
    doc.add_paragraph(
        "• 集中式提示词目录：系统所有发送给大模型的 Prompt（包括灵感追问、聚焦提炼、阶段生成、兵力推荐、红方对抗等）全部纳入顶部菜单“AI 提示词”统一目录。\n"
        "• 透明化配置与实时生效：分配稳定 ID、动态变量说明与用途阐述，研究员可在线定制修改并即刻应用于 AI 生成请求，杜绝黑盒代码。\n"
        "• 密钥环境安全隔离：大模型 API Key 仅在安全进程环境中以环境变量加载，禁止写入任何代码、配置文件、数据库或导出报告中。"
    )

    # ---------------- 第五章：部署与操作快速指南 ----------------
    add_h1("五、部署使用与操作指南")

    add_h2("5.1 环境要求与一键启动")
    doc.add_paragraph(
        "系统优化为零配置快速部署："
    )
    doc.add_paragraph(
        "1. 环境依赖：Windows 10/11 或 Linux，安装 Node.js (推荐 v22.5+ 或 v24+，支持内置 SQLite) 及 Python 3.10+。\n"
        "2. 一键启动：在根目录下直接双击运行 start.bat（或在终端执行 .\\start.ps1 / ./start.sh）。脚本将自动检测环境、端口占用，拉起工作台（8792）及外部标绘工具（8765），并自动在浏览器中打开主界面。\n"
        "3. 安全停止：双击 stop.bat 或执行 .\\stop.ps1 安全释放端口。"
    )

    add_h2("5.2 双模式操作体验")
    doc.add_paragraph(
        "界面顶部操作栏提供模式切换："
    )
    doc.add_paragraph(
        "• 正式解锁模式（推荐）：严格按照“简报 -> 阶段行动 -> 作战任务 -> 作战兵力 -> 总体图 -> 概念图 -> 仿真演示”的门禁顺序递进。每步确认后自动驱动下一步初始数据的 AI 种子化生成，确保研究逻辑闭环。\n"
        "• 自由测试模式：解除左侧流程轨道的阶段锁定，允许研究人员在 7 个主步骤与 11 个关联模型之间自由跳转与逐项试用，不强制校验准出门禁。"
    )

    add_h2("5.3 典型研究工作闭环示范（15分钟快速指引）")
    doc.add_paragraph(
        "1. 开启灵感：进入【简报】，在左侧灵感输入框输入初始构想（例如“无人艇集群夜间联合防空压制”），与 AI 展开 2~3 轮对话，挑选合适的方向卡片，确认六要素简报。\n"
        "2. 生成阶段：点击【阶段行动】，AI 自动生成 3 个作战聚焦，确认后自动生成 3~5 个时序作战阶段与红蓝双方行动，人工微调后确认。\n"
        "3. 细化任务与兵力：系统自动进入【作战任务】生成任务列表；确认后进入【作战兵力】，匹配 CMO 推荐平台并绑定承接关系。\n"
        "4. 闭环总体图：进入【总体图】，检查红蓝节点与信息/控制/打击/反馈四类流向，确认拓扑闭环。\n"
        "5. 态势标绘与推演：进入【概念图】完成空间相对标绘，在【仿真演示】中运行设计验证，审查红方反制意见。\n"
        "6. 输出成果：点击顶部【成果报告】或导出菜单，一键导出完整 Word/PDF 研究报告或 PPT 汇报文稿。"
    )

    # ---------------- 第六章：总结与展望 ----------------
    add_h1("六、总结与展望")
    doc.add_paragraph(
        "作战概念研究工作台通过将生成式人工智能、体系架构方法学（DoDAF 2.02）与知识图谱深度融合，成功搭建了从前沿战术灵感到工程化作战想定的数字桥梁。平台坚持“AI 为辅助、专家为主导”的人机协同理念，实现了全链路可追溯、跨视图可验证、数据资产可继承的现代化作战概念论证新范式。"
    )
    doc.add_paragraph(
        "未来，工作台将进一步深化与重型分布式兵棋推演系统的标准接口对接，扩展多方案自动化博弈评估与智能敏感性归因分析能力，为国防科研与作战概念创新提供更为强劲的技术支撑。"
    )

    # 保存文档
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    out_dir = r"d:\项目\combat-concept-ai-workbench"
    out_file = os.path.join(out_dir, "作战概念研究工作台_项目功能说明书.docx")
    build_document(out_file)
