# 实验一 开发任务 商品名称搜索

你是本次软件工程实验的开发人员，我是项目经理柴清会。请你或你的 agent 按以下要求完成开发与提交。本任务使用老师实验报告模板的基础流程：从 main 创建 dev，提交 dev 到 main 的 PR，由项目经理检查和合并。

仓库：https://github.com/chihiroyusa184-web/cqh-app-dianshang

克隆地址：https://github.com/chihiroyusa184-web/cqh-app-dianshang.git

开发前提：项目经理已将初始源码上传到 main，你已接受仓库协作者邀请。若仓库仍为空，请先告知项目经理上传源码，等源码可用后继续，不要另外重建一套系统。

## 1 Issue 内容

请先在仓库 Issues 中创建下面的任务；若已有相同任务，则复用。把 Issue 链接发给项目经理，由项目经理将 Assignees 指派给你后开始开发。

**标题：增加商品名称搜索功能**

**背景：**电商促销系统目前展示全部商品，缺少按商品名称查找的功能。

**需求：**

1. 在商品列表上方增加搜索框、搜索按钮和清空按钮。
2. 后端支持 `GET /api/products?keyword=关键词`，按照商品名称包含关键词进行匹配；去掉关键词首尾空格，英文字母不区分大小写。
3. 未提供 keyword、关键词为空或全为空格时，返回全部商品。
4. 找不到匹配商品时，接口返回 HTTP 200 和空数组 `[]`，页面显示“没有找到商品”。返回商品的字段保持原样。
5. 搜索只筛选显示列表，不修改库存、已选商品数量或订单数据；清空搜索后能够看到之前填写的数量。
6. 原有优惠计算、下单、库存和运营管理功能应保持正常。

**验收示例：**

| 操作 | 预期结果 |
|---|---|
| 使用初始数据进入页面 | 显示机械键盘、无线鼠标、USB扩展器 |
| 搜索“键盘” | 只显示机械键盘 |
| 搜索“ 鼠标 ” | 只显示无线鼠标 |
| 搜索“usb” | 显示USB扩展器 |
| 搜索“不存在的商品” | 显示“没有找到商品”，接口返回空数组 |
| 清空搜索 | 恢复全部商品 |
| 先选2件键盘，再搜索鼠标，最后清空 | 键盘数量仍为2，搜索本身不扣库存 |
| 2件键盘使用SAVE20试算 | 原价258元、优惠20元、应付238元 |

## 2 实现与验证

项目使用 Node.js 20或以上版本、原生 JavaScript、HTML 和 CSS，无第三方依赖。重点查看仓库中的这些文件：

- `server.js`：商品查询接口及请求参数处理。
- `public/index.html`：商品列表、已选数量、搜索交互与空结果提示。
- `test/system.test.js`：现有测试；可在此补充搜索测试，或新增测试文件。
- `README.md`：补充搜索功能使用方法。

如果上传后的源码位于子目录，先找到包含 package.json 和 server.js 的项目根目录，再执行命令。

运行 `node server.js`，浏览器访问 `http://127.0.0.1:3000`。运行 `node --test` 验证全部测试。补充正常匹配、空关键词、无匹配、首尾空格和英文大小写的 HTTP 测试，并手工验证数量保留及原有下单流程。现有21项测试应继续通过；如基线已更新，以仓库实际测试为准。

## 3 Git 与 PR 提交

使用开发同学本人的 Git 身份和 GitHub 账号。首次克隆后执行：

```powershell
git clone https://github.com/chihiroyusa184-web/cqh-app-dianshang.git
cd cqh-app-dianshang
git switch main
git pull --ff-only origin main
git switch -c dev
```

如果本地已有该仓库或 dev，先检查状态，保留现有工作再继续，不覆盖已有分支。完成功能并通过测试后提交：

```powershell
git status
git add server.js public/index.html test README.md
git commit -m "feat: add product name search"
git push -u origin dev
```

上述 add 命令按源码在仓库根目录编写；如项目在子目录，使用相应实际路径。只暂存本任务文件，运行数据 data、node_modules、.env 和真实令牌不提交。

在 GitHub 创建 PR：`base: main`，`compare: dev`。标题填写“增加商品名称搜索功能”，描述包含功能说明、测试命令及实际结果，并写 `Closes #实际Issue编号`，将本任务与 PR 关联。请求项目经理审查，保留 PR 等待项目经理合并。

若项目经理提出修改意见，在原 dev 分支修复、重新测试并推送，更新同一个 PR。

## 4 发回项目经理的内容

完成开发后，请提供：Issue 链接、PR 链接、提交编号、实际测试结果，以及搜索前、搜索后和无结果页面截图。项目经理负责最后的测试验收、合并、确认 Issue 关闭和分支清理。
