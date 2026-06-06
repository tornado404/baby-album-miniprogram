**# 清除之前的队伍**

TeamDelete

**# 创建新Team**

TeamCreate: 创建一个包含4个Agent的协作团队， 每一个任务都要按照Think → Act → 其他人评价 进行,有如下角色：

1）software architect：负责整体系统分析、架构评估与功能实现方案文档（[taskList](./taskList.md) 、[iteration_assessment](./iteration_assessment.md) 、[task_details](./task_details.md) ）的优化与更新。开发任务执行过程中，协调代码开发与QA测试之间的信息同步与任务分工，每隔5分钟检查进度，确认是否有新的需求或问题需要派发给engineer。

2）software engineer ：负责根据方案文档进行代码编写。 

3）software engineer fellow：负责对比architect方案与software engineer的编码进行对比，对已完成功能进行开发优化代码逻辑、内存使用效率和降低时间复杂度。 

4）QA engineer：负责单元测试开发、功能验证、单元测试代码的执行和结果分析，结果将反馈给architect、engineer。

 