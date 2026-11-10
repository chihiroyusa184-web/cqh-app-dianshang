# 实验一 发给开发同学及其 agent 的任务说明

我是项目经理柴清会，你是开发人员。请使用你本人的Git身份和GitHub账号，在现有项目上完成下面两部分任务，并保留真实操作记录。

仓库：https://github.com/chihiroyusa184-web/cqh-app-dianshang

克隆地址：https://github.com/chihiroyusa184-web/cqh-app-dianshang.git

基础源码已上传到main。先把你的GitHub用户名发给我，接受协作者邀请后开始。项目使用Node.js 20或以上版本、原生JavaScript、HTML和CSS，无第三方依赖；在仓库根目录运行`node server.js`，访问`http://127.0.0.1:3000`，运行`node --test`测试。原始版本有21项测试，后续应保持通过。

老师的报告模板要求`main + dev`基础协作，另一份GitFlow题目要求`main + develop + feature/* + release/*`五阶段。请按顺序完成A和B，分别提交PR。两部分之间及评审、冲突处理时需要双方配合，遇到依赖项目经理的步骤请告知我并等待，不替我操作账号或合并。

## A 基础协作 商品名称搜索

**Issue标题：增加商品名称搜索功能。**

请先在仓库Issues提出此需求，若已有同任务则复用；把链接发我，由我在Assignees中指派给你后开发。

需求和验收：

1. 商品列表上方增加搜索框、搜索按钮和清空按钮。
2. 后端支持`GET /api/products?keyword=关键词`，按商品名称包含关键词匹配，去掉首尾空格，英文忽略大小写；未传、空字符串和全空格均显示全部商品。
3. 搜索“键盘”只显示机械键盘；搜索“ 鼠标 ”只显示无线鼠标；搜索“usb”匹配USB扩展器。
4. 无匹配时接口返回200和`[]`，页面提示“没有找到商品”；清空后恢复全部。
5. 搜索只筛选列表，不改变库存、订单或购物车数量。例如先填键盘2件，搜索鼠标再清空，键盘数量仍为2。
6. 补充正常匹配、空关键词、无匹配、空格及大小写的HTTP测试；更新README。原有优惠、下单和管理功能继续正常，两件键盘使用SAVE20仍应为258元减20元、应付238元。

主要文件：`server.js`、`public/index.html`、`test/`、`README.md`。

```powershell
git clone https://github.com/chihiroyusa184-web/cqh-app-dianshang.git
cd cqh-app-dianshang
git switch main
git pull --ff-only origin main
git switch -c dev
# 开发并测试
node --test
git add server.js public/index.html test README.md
git commit -m "feat: add product name search"
git push -u origin dev
```

创建`dev → main`的PR，请求仓库所有者`chihiroyusa184-web`审查。描述写清修改、实际测试结果及`Closes #本部分实际Issue编号`。我获取代码检查测试，提出意见或合并；你在原dev分支修复并推送即可更新同一PR。合并后由我确认Issue关闭并清理远程dev。

若你已有克隆或同名分支，先检查状态，保留原有工作，不重复创建或覆盖。

## B GitFlow 优惠券计算改进

先等我合并A，再由我从最新main创建并推送develop、安排分支保护和评审。你不要从旧main开始，也不要预先代建PM的release分支。

**Issue标题：优惠券计算增加最优券推荐。**请另建或复用此任务，由我指派给你。

当前项目已有手工输入券码的计算功能，本部分增加：

1. 新增`POST /api/quote/best`，输入`{ "items": [{ "productId": "P1001", "quantity": 2 }] }`。服务端比较无券及所有启用、未过期且达到门槛的优惠券，返回应付最低的一份现有Quote结构；不叠加优惠券。
2. 同金额优先不用券；不同券同金额时按券码字符顺序选择，保证结果稳定。没有可用券时按原价返回；购物车非法或库存不足沿用原接口校验。
3. 页面增加“自动选券”按钮，展示推荐券和应付金额，并把推荐券码填入原有输入框；用户仍可手动更改。试算不扣库存，下单时仍由服务端重新计算。
4. 示例：两件键盘258元，SAVE20应付238元，OFF10应付232.20元，应推荐OFF10；一件鼠标59元不满足现有券门槛，应返回无券59元。
5. 补充最优比较、无券、过期或停用券、门槛、封顶、同金额选择、错误输入及不改变库存的测试，更新README，保留A的搜索功能。

主要文件：`src/domain.js`、`server.js`、`public/index.html`、`test/`、`README.md`。

```powershell
git fetch origin
git switch -c develop --track origin/develop
git pull --ff-only origin develop
git switch -c feature/coupon-calc
# 实现功能后只暂存实际修改的文件
git add src server.js public/index.html test README.md
git commit -m "feat: recommend the best eligible coupon"
git push -u origin feature/coupon-calc
```

如果develop本地已存在，直接切换并同步，无须再创建。发起`feature/coupon-calc → develop`的PR，请求我审查。

### 并发冲突与Review配合

- 开发前与我约定`src/domain.js`首行注释作为同一行修改点，你在自己的分支补充“支持最优券推荐”的说明。我在另一分支修改该行并先合入develop，制造真实合并冲突。保留冲突PR页面截图。
- 老师题目同时写了“develop禁止直接Push”和“PM直接Push制造冲突”，两者矛盾；我们的执行采用PM的独立PR先合入develop，保留保护规则，并在报告说明这个等效方案。
- 我通知develop已更新后，你在feature分支执行`git fetch origin`、`git merge origin/develop`，解决冲突、暂存并提交；运行`node --test`通过后推送，更新同一个PR。
- 为演示题目中的“硬编码测试密钥、缺少单元测试”Review，第一版PR可明确标注为课堂审查演练：在独立演练文件`src/coupon-review-demo.js`中放置无效常量`const TEST_KEY = 'DEMO_ONLY_NOT_A_SECRET';`，不接入业务；本部分新增测试先列为待补。PR描述明确标注这两项是演练中的已知问题，已有测试仍需通过，不使用真实凭据。
- 我提交Request changes后，你删除该演练文件，补齐本功能测试，运行全部测试并提交、推送到原feature分支。记录修改前后提交和Review反馈。
- 复审通过后，由我选择Squash and merge合入develop并清理feature分支。你不要自行合并，也不要删除仍需演示的分支。

### 发布配合

后续由我创建`release/v1.0.0`，准备版本及发布说明，测试后分别PR合入main和develop、打`v1.0.0`标签并发布GitHub Release及源码Asset。你提供测试结果、变更说明，并在收到请求时协助Review。若你的代码涉及发版修复，只在约定的修复分支提交PR，不直接推送受保护分支。

GitFlow任务的PR目标是develop。GitHub的`Closes #编号`通常只在合入默认分支时自动关闭Issue，因此由我在完成验收后确认并关闭；不要把合入develop就自动关闭当作已验证事实。

## 交付给项目经理

两部分各提供Issue和PR链接、分支名、提交编号、测试命令及实际输出、修改文件说明。保存开发分支、功能效果、冲突、Review反馈、修复提交和测试通过截图，供实验报告使用。截图和报告描述必须对应实际操作。

只提交任务相关源码和说明，`data/`、`node_modules/`、`.env`和真实令牌不提交。项目经理负责权限、任务分派、审查验收、合并、关闭Issue和版本发布；遇到这些协作节点请发我链接或说明所需动作。
