# TattooVis：关键词筛选与网页 SEO 优化

数据来源：用户提供的 `AI-Tattoo-Generator_pages_2026-10-31.xlsx`，Keywords 工作表。共 1,191 条不重复关键词，Database 均为 US。以下搜索量和 Keyword Difficulty 均引用原表，未重新查询实时 Semrush 数据。搜索量是工具估算，不是网站流量，也不代表可以获得的访问量。不同变体不相加计算流量机会。

## 筛选结果

| 处理 | 数量 | 含义 |
| --- | ---: | --- |
| 本次采用 | 42 | 分配至首页、生成页和三篇设计指南 |
| 排除本次 | 95 | 明显意图错位或没有对应功能，如成人生图、免注册承诺、双向字／字体、实体纹身贴纸及竞品品牌词 |
| 后续评估 | 1,054 | 本次未逐个开发对应内容，并非全部无价值；需要实际案例、独立内容或能力验证 |

完整逐词处理结果见工作区 `TattooVis_SEO_关键词筛选_2026-10-31.csv`，可用 Excel 打开。仓库中的 `keyword-map-2026-10-31.csv` 保存本次采用的 42 条及对应路径。未照搬原表 Page 字段：例如原表将 `ai tattoo generator` 分入 `tattoo cover up generator`，并不能证明本站应主打遮盖功能。

## 核心页面与原表指标

| 关键词 | 美国月搜索量 | KD | 目标页面 | 用法 |
| --- | ---: | ---: | --- | --- |
| ai tattoo generator | 22,200 | 65 | `/` | 首页主意图、标题与 H1 |
| tattoo generator | 14,800 | 54 | `/` | 自然近义表达，不单独创建重复页面 |
| tattoo design generator | 2,400 | 50 | `/` | 设计能力说明 |
| ai tattoo | 2,400 | 46 | `/` | 正文语义覆盖 |
| ai tattoo generator free | 6,600 | 61 | `/` | 明确案例免费及注册赠送积分，不承诺无限生成 |
| tattoo generator free | 4,400 | 54 | `/` | 与上一行相同的真实使用条件 |
| tattoo simulator | 1,000 | 33 | `/generate` | 照片试戴意图，避免与首页完全相同的标题 |
| minimal design tattoo | 4,400 | 21 | `/tattoo-ideas/minimalist` | 极简设计指南，用自然英文表达，不强塞原始词序 |
| design minimalist tattoo | 3,600 | 20 | `/tattoo-ideas/minimalist` | 同一意图合并覆盖 |
| minimalist tattoo | 8,100 | 39 | `/tattoo-ideas/minimalist` | 主题词及真实可修改提示词 |
| geometric tattoos | 6,600 | 31 | `/tattoo-ideas/geometric` | 几何主题及已有真实狼头案例 |
| geometric tattoo designs | 2,900 | 31 | `/tattoo-ideas/geometric` | 提示词、对称性及构图检查 |
| geometric tattoo ideas | 1,000 | 27 | `/tattoo-ideas/geometric` | 设计探索意图 |
| geometric style tattoo | 320 | 16 | `/tattoo-ideas/geometric` | 风格解释，不再创建近似页面 |
| first tattoo ideas | 3,600 | 22 | `/tattoo-ideas/first-tattoo` | 首次纹身设计与沟通准备 |
| first tattoo designs | 880 | 20 | `/tattoo-ideas/first-tattoo` | 设计简报及不同视觉方向 |
| best placement for first tattoo | 320 | 16 | `/tattoo-ideas/first-tattoo` | 提供位置比较方法，不给出统一最佳位置或医疗判断 |

高搜索量核心词用于建立主题定位；相关长尾词用于提供更具体的答案。KD 低不等于容易排名，更不能替代搜索意图与内容质量判断。

## 后续值得验证的方向

| 关键词 | 美国月搜索量 | KD | 本次暂缓原因 |
| --- | ---: | ---: | --- |
| birth flower tattoo generator | 720 | 7 | 值得单独验证花卉设计与试戴案例，再制作对应入口；本次没有包装成已完成的专用生成器 |
| birth flower bouquet tattoo generator | 320 | 8 | 同上，需要与一般花卉设计区分 |
| family birth flower bouquet tattoo generator | 170 | 4 | 需要验证多朵花的构图与家庭主题内容 |
| tattoo prompt generator | 140 | 19 | 目前有提示词示例，没有独立自动提示词生成器，避免功能承诺错位 |

其他体位、风格及主题词保留为后续选题。每次扩展应先准备真正有用的内容与结果示例，避免只替换关键词批量建页。

## 本次网页调整

1. 中英文首页增加明确的 AI 纹身生成主题，区分案例免费和使用自身照片需要账户／积分的条件；补充风格问题及结果限制，调整缺少依据的速度描述。
2. 生成页拥有独立标题、可见 H1 和服务器输出的工具说明。访客在登录组件加载前也能阅读核心信息，搜索引擎不必登录才能理解页面用途。
3. 增加设计灵感入口及三篇中英文指南。内容包含不同主题的选型建议、三组可修改提示词、照片检查方法、生成入口和相关指南内链；未知 slug 返回 404。
4. 标题、描述、Open Graph、Twitter 元数据沿用统一配置；规范化网址结尾斜杠并增加语言版本及默认语言标记。
5. Sitemap 覆盖首页、生成、价格及指南的中英文版本；不包含 History、设置或试戴实验页。
6. Preview 元数据使用 noindex，robots 阻止 Preview 抓取。正式站保留公开内容可抓取性，取消对隐私及条款页面的无必要屏蔽。
7. 登录页及未用于纹身产品的模板音乐／视频／通用生图入口不参与索引。隐藏没有可核实依据的模板评价及头像背书，真实案例保留。
8. 没有修改套餐价格、积分包数量、实际计费或当前四部位生成方式，没有把尚未上线的图案库和单部位工作室当作正式能力宣传。

## 验证与发布边界

- SEO 回归覆盖中英文 canonical/hreflang、Preview noindex、sitemap、指南服务器 HTML、单 H1、提示词和内链、未知 slug。
- 另行运行完整测试、类型检查、代码检查与 Next.js 构建，检查实际输出 HTML 和移动端布局。结果在交付时说明，不能仅凭源码推断已经通过。
- 此次只发布到 Preview 分支，不直接更新正式站。Preview 的内容不会带来生产域名排名变化；需要正式发布并等待搜索引擎重新抓取。
- 未取得 Search Console 或 GA4 的实际表现数据，也未测量真实用户 Core Web Vitals；不能承诺排名、流量或特定上线见效时间。

方法参考：[Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)。以清晰页面用途、实用独特内容和描述性内链为重点；没有关键词密度目标，也没有通过 meta keywords 堆叠来代替正文。

Verification completed: 207 tests across 50 files passed; types and Next.js Webpack production build passed; lint has no new errors. Actual HTTP/HTML checks verified one H1, one set of page-specific en/zh/x-default links, localized internal links, correct canonicals and unknown-guide 404s. Desktop 1440px and mobile 390px checked; no horizontal mobile overflow. No paid AI calls or production data changes.
