---
title: 任务依赖与工作流调度
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在复杂的业务场景中，任务之间往往存在复杂的依赖关系。一个任务的执行可能需要等待其他任务的完成，或者多个任务需要按照特定的顺序执行。这就需要我们引入任务依赖和工作流调度的概念。本文将深入探讨 DAG（有向无环图）模型、上下游依赖处理以及主流工作流引擎的实现原理。

## DAG（有向无环图）模型

DAG（Directed Acyclic Graph，有向无环图）是表示任务依赖关系的数学模型。在 DAG 中，节点代表任务，有向边代表任务间的依赖关系，无环特性确保了任务执行不会出现死循环。

### DAG 基本概念

在 DAG 模型中：

1. **节点（Vertex）**：代表一个具体的任务
2. **边（Edge）**：代表任务间的依赖关系，从上游任务指向下游任务
3. **入度（In-degree）**：指向某个节点的边的数量，表示该任务依赖的上游任务数量
4. **出度（Out-degree）**：从某个节点出发的边的数量，表示该任务影响的下游任务数量

### DAG 实现

```java
import java.util.*;

// DAG 节点定义
public class DAGNode {
    private String taskId;
    private String taskName;
    private Object taskData;
    private Set<String> dependencies; // 依赖的上游任务
    private Set<String> dependents;   // 依赖此任务的下游任务
    
    public DAGNode(String taskId, String taskName) {
        this.taskId = taskId;
        this.taskName = taskName;
        this.dependencies = new HashSet<>();
        this.dependents = new HashSet<>();
    }
    
    // 添加依赖关系
    public void addDependency(String dependencyTaskId) {
        this.dependencies.add(dependencyTaskId);
    }
    
    // 添加被依赖关系
    public void addDependent(String dependentTaskId) {
        this.dependents.add(dependentTaskId);
    }
    
    // getters and setters
    public String getTaskId() { return taskId; }
    public String getTaskName() { return taskName; }
    public Set<String> getDependencies() { return dependencies; }
    public Set<String> getDependents() { return dependents; }
    public Object getTaskData() { return taskData; }
    public void setTaskData(Object taskData) { this.taskData = taskData; }
}

// DAG 图结构
public class TaskDAG {
    private Map<String, DAGNode> nodes;
    private List<String> executionOrder; // 拓扑排序后的执行顺序
    
    public TaskDAG() {
        this.nodes = new HashMap<>();
        this.executionOrder = new ArrayList<>();
    }
    
    // 添加节点
    public void addNode(String taskId, String taskName) {
        if (!nodes.containsKey(taskId)) {
            nodes.put(taskId, new DAGNode(taskId, taskName));
        }
    }
    
    // 添加依赖关系
    public boolean addEdge(String fromTaskId, String toTaskId) {
        DAGNode fromNode = nodes.get(fromTaskId);
        DAGNode toNode = nodes.get(toTaskId);
        
        if (fromNode == null || toNode == null) {
            return false;
        }
        
        // 检查是否会形成环
        if (wouldCreateCycle(fromTaskId, toTaskId)) {
            throw new IllegalArgumentException("Adding this edge would create a cycle");
        }
        
        fromNode.addDependent(toTaskId);
        toNode.addDependency(fromTaskId);
        return true;
    }
    
    // 检查是否会形成环
    private boolean wouldCreateCycle(String fromTaskId, String toTaskId) {
        // 如果目标节点是源节点的上游节点，则会形成环
        return isUpstream(toTaskId, fromTaskId);
    }
    
    // 检查 taskId1 是否是 taskId2 的上游节点
    private boolean isUpstream(String taskId1, String taskId2) {
        DAGNode node = nodes.get(taskId2);
        if (node == null) return false;
        
        for (String dependency : node.getDependencies()) {
            if (dependency.equals(taskId1)) {
                return true;
            }
            if (isUpstream(taskId1, dependency)) {
                return true;
            }
        }
        return false;
    }
    
    // 拓扑排序，确定执行顺序
    public List<String> topologicalSort() {
        List<String> result = new ArrayList<>();
        Map<String, Integer> inDegrees = new HashMap<>();
        Queue<String> queue = new LinkedList<>();
        
        // 计算每个节点的入度
        for (DAGNode node : nodes.values()) {
            inDegrees.put(node.getTaskId(), node.getDependencies().size());
            if (node.getDependencies().isEmpty()) {
                queue.offer(node.getTaskId());
            }
        }
        
        // 拓扑排序
        while (!queue.isEmpty()) {
            String currentTaskId = queue.poll();
            result.add(currentTaskId);
            
            DAGNode currentNode = nodes.get(currentTaskId);
            for (String dependent : currentNode.getDependents()) {
                int newInDegree = inDegrees.get(dependent) - 1;
                inDegrees.put(dependent, newInDegree);
                if (newInDegree == 0) {
                    queue.offer(dependent);
                }
            }
        }
        
        // 检查是否存在环
        if (result.size() != nodes.size()) {
            throw new IllegalStateException("Graph contains a cycle");
        }
        
        this.executionOrder = result;
        return result;
    }
    
    // 获取可以并行执行的任务组
    public List<Set<String>> getParallelExecutionGroups() {
        if (executionOrder.isEmpty()) {
            topologicalSort();
        }
        
        List<Set<String>> groups = new ArrayList<>();
        Map<String, Integer> taskLevels = calculateTaskLevels();
        
        // 按层级分组
        Map<Integer, Set<String>> levelGroups = new HashMap<>();
        for (Map.Entry<String, Integer> entry : taskLevels.entrySet()) {
            levelGroups.computeIfAbsent(entry.getValue(), k -> new HashSet<>())
                      .add(entry.getKey());
        }
        
        // 按层级顺序添加到结果中
        for (int i = 0; i <= Collections.max(levelGroups.keySet()); i++) {
            Set<String> group = levelGroups.get(i);
            if (group != null && !group.isEmpty()) {
                groups.add(new HashSet<>(group));
            }
        }
        
        return groups;
    }
    
    // 计算每个任务的层级
    private Map<String, Integer> calculateTaskLevels() {
        Map<String, Integer> levels = new HashMap<>();
        
        // 初始化所有任务的层级为0
        for (String taskId : nodes.keySet()) {
            levels.put(taskId, 0);
        }
        
        // 按拓扑顺序更新层级
        for (String taskId : executionOrder) {
            DAGNode node = nodes.get(taskId);
            int currentLevel = levels.get(taskId);
            
            // 更新所有下游任务的层级
            for (String dependent : node.getDependents()) {
                int dependentLevel = levels.get(dependent);
                if (dependentLevel <= currentLevel) {
                    levels.put(dependent, currentLevel + 1);
                }
            }
        }
        
        return levels;
    }
    
    // 获取节点
    public DAGNode getNode(String taskId) {
        return nodes.get(taskId);
    }
    
    // 获取所有节点
    public Collection<DAGNode> getAllNodes() {
        return nodes.values();
    }
}
```

### DAG 使用示例

```java
public class DAGExample {
    public static void main(String[] args) {
        TaskDAG dag = new TaskDAG();
        
        // 添加任务节点
        dag.addNode("task1", "数据采集");
        dag.addNode("task2", "数据清洗");
        dag.addNode("task3", "数据转换");
        dag.addNode("task4", "数据分析");
        dag.addNode("task5", "报告生成");
        dag.addNode("task6", "数据备份");
        
        // 添加依赖关系
        dag.addEdge("task1", "task2"); // 数据采集 -> 数据清洗
        dag.addEdge("task2", "task3"); // 数据清洗 -> 数据转换
        dag.addEdge("task3", "task4"); // 数据转换 -> 数据分析
        dag.addEdge("task4", "task5"); // 数据分析 -> 报告生成
        dag.addEdge("task1", "task6"); // 数据采集 -> 数据备份
        dag.addEdge("task3", "task6"); // 数据转换 -> 数据备份
        
        // 执行拓扑排序
        List<String> executionOrder = dag.topologicalSort();
        System.out.println("任务执行顺序: " + executionOrder);
        
        // 获取并行执行组
        List<Set<String>> parallelGroups = dag.getParallelExecutionGroups();
        System.out.println("并行执行组:");
        for (int i = 0; i < parallelGroups.size(); i++) {
            System.out.println("  第" + (i+1) + "组: " + parallelGroups.get(i));
        }
    }
}
```

## 上下游依赖处理

在实际的任务调度系统中，需要处理复杂的上下游依赖关系，包括任务状态传播、依赖检查和异常处理等。

### 依赖状态管理

```java
// 任务状态枚举
public enum TaskStatus {
    PENDING,    // 等待执行
    RUNNING,    // 正在执行
    SUCCESS,    // 执行成功
    FAILED,     // 执行失败
    SKIPPED     // 被跳过
}

// 任务执行上下文
public class TaskExecutionContext {
    private String taskId;
    private TaskStatus status;
    private String result;
    private Exception error;
    private long startTime;
    private long endTime;
    private Map<String, Object> contextData;
    
    public TaskExecutionContext(String taskId) {
        this.taskId = taskId;
        this.status = TaskStatus.PENDING;
        this.contextData = new HashMap<>();
    }
    
    // getters and setters
    public String getTaskId() { return taskId; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Exception getError() { return error; }
    public void setError(Exception error) { this.error = error; }
    public long getStartTime() { return startTime; }
    public void setStartTime(long startTime) { this.startTime = startTime; }
    public long getEndTime() { return endTime; }
    public void setEndTime(long endTime) { this.endTime = endTime; }
    public Map<String, Object> getContextData() { return contextData; }
    
    public long getDuration() {
        return endTime > 0 ? endTime - startTime : System.currentTimeMillis() - startTime;
    }
}

// 依赖管理器
public class DependencyManager {
    private TaskDAG taskDAG;
    private Map<String, TaskExecutionContext> taskContexts;
    private Map<String, List<TaskDependencyListener>> listeners;
    
    public DependencyManager(TaskDAG taskDAG) {
        this.taskDAG = taskDAG;
        this.taskContexts = new ConcurrentHashMap<>();
        this.listeners = new ConcurrentHashMap<>();
    }
    
    // 检查任务是否可以执行（所有依赖都已完成）
    public boolean canExecute(String taskId) {
        DAGNode node = taskDAG.getNode(taskId);
        if (node == null) return false;
        
        // 检查所有依赖任务是否都成功完成
        for (String dependencyId : node.getDependencies()) {
            TaskExecutionContext context = taskContexts.get(dependencyId);
            if (context == null || context.getStatus() != TaskStatus.SUCCESS) {
                return false;
            }
        }
        
        return true;
    }
    
    // 更新任务状态
    public void updateTaskStatus(String taskId, TaskStatus status, String result, Exception error) {
        TaskExecutionContext context = taskContexts.computeIfAbsent(taskId, 
            k -> new TaskExecutionContext(taskId));
        
        TaskStatus oldStatus = context.getStatus();
        context.setStatus(status);
        context.setResult(result);
        context.setError(error);
        
        if (status == TaskStatus.RUNNING) {
            context.setStartTime(System.currentTimeMillis());
        } else if (status == TaskStatus.SUCCESS || status == TaskStatus.FAILED) {
            context.setEndTime(System.currentTimeMillis());
        }
        
        // 通知监听器
        notifyListeners(taskId, oldStatus, status);
        
        // 如果任务完成，检查下游任务是否可以执行
        if (status == TaskStatus.SUCCESS || status == TaskStatus.FAILED) {
            checkDownstreamTasks(taskId);
        }
    }
    
    // 检查下游任务是否可以执行
    private void checkDownstreamTasks(String taskId) {
        DAGNode node = taskDAG.getNode(taskId);
        if (node == null) return;
        
        for (String dependentId : node.getDependents()) {
            if (canExecute(dependentId)) {
                // 触发下游任务执行
                triggerTaskExecution(dependentId);
            }
        }
    }
    
    // 触发任务执行
    private void triggerTaskExecution(String taskId) {
        // 这里应该调用实际的任务执行器
        System.out.println("触发任务执行: " + taskId);
        
        // 通知监听器
        notifyTaskReady(taskId);
    }
    
    // 添加依赖监听器
    public void addDependencyListener(String taskId, TaskDependencyListener listener) {
        listeners.computeIfAbsent(taskId, k -> new ArrayList<>()).add(listener);
    }
    
    // 通知监听器任务状态变化
    private void notifyListeners(String taskId, TaskStatus oldStatus, TaskStatus newStatus) {
        List<TaskDependencyListener> taskListeners = listeners.get(taskId);
        if (taskListeners != null) {
            for (TaskDependencyListener listener : taskListeners) {
                listener.onTaskStatusChanged(taskId, oldStatus, newStatus);
            }
        }
    }
    
    // 通知监听器任务可以执行
    private void notifyTaskReady(String taskId) {
        List<TaskDependencyListener> taskListeners = listeners.get(taskId);
        if (taskListeners != null) {
            for (TaskDependencyListener listener : taskListeners) {
                listener.onTaskReady(taskId);
            }
        }
    }
    
    // 获取任务上下文
    public TaskExecutionContext getTaskContext(String taskId) {
        return taskContexts.get(taskId);
    }
}

// 任务依赖监听器接口
public interface TaskDependencyListener {
    void onTaskStatusChanged(String taskId, TaskStatus oldStatus, TaskStatus newStatus);
    void onTaskReady(String taskId);
}
```

### 任务执行器

```java
// 任务接口
public interface Task {
    TaskResult execute(TaskExecutionContext context);
}

// 任务执行结果
public class TaskResult {
    private boolean success;
    private String message;
    private Map<String, Object> outputData;
    
    public TaskResult(boolean success, String message) {
        this.success = success;
        this.message = message;
        this.outputData = new HashMap<>();
    }
    
    // getters and setters
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Map<String, Object> getOutputData() { return outputData; }
    
    public static TaskResult success(String message) {
        return new TaskResult(true, message);
    }
    
    public static TaskResult failure(String message) {
        return new TaskResult(false, message);
    }
}

// 任务执行器
public class TaskExecutor {
    private DependencyManager dependencyManager;
    private ExecutorService executorService;
    private Map<String, Task> taskRegistry;
    
    public TaskExecutor(DependencyManager dependencyManager) {
        this.dependencyManager = dependencyManager;
        this.executorService = Executors.newFixedThreadPool(10);
        this.taskRegistry = new ConcurrentHashMap<>();
    }
    
    // 注册任务
    public void registerTask(String taskId, Task task) {
        taskRegistry.put(taskId, task);
    }
    
    // 执行任务
    public void executeTask(String taskId) {
        Task task = taskRegistry.get(taskId);
        if (task == null) {
            dependencyManager.updateTaskStatus(taskId, TaskStatus.FAILED, 
                                             "Task not found", null);
            return;
        }
        
        // 更新任务状态为运行中
        dependencyManager.updateTaskStatus(taskId, TaskStatus.RUNNING, null, null);
        
        // 异步执行任务
        executorService.submit(() -> {
            try {
                TaskExecutionContext context = dependencyManager.getTaskContext(taskId);
                TaskResult result = task.execute(context);
                
                if (result.isSuccess()) {
                    dependencyManager.updateTaskStatus(taskId, TaskStatus.SUCCESS, 
                                                     result.getMessage(), null);
                } else {
                    dependencyManager.updateTaskStatus(taskId, TaskStatus.FAILED, 
                                                     result.getMessage(), null);
                }
            } catch (Exception e) {
                dependencyManager.updateTaskStatus(taskId, TaskStatus.FAILED, 
                                                 "Task execution failed", e);
            }
        });
    }
    
    // 启动工作流
    public void startWorkflow(TaskDAG dag) {
        // 添加依赖监听器
        for (DAGNode node : dag.getAllNodes()) {
            dependencyManager.addDependencyListener(node.getTaskId(), 
                new TaskDependencyListener() {
                    @Override
                    public void onTaskStatusChanged(String taskId, TaskStatus oldStatus, 
                                                  TaskStatus newStatus) {
                        // 状态变化处理
                    }
                    
                    @Override
                    public void onTaskReady(String taskId) {
                        // 任务可以执行时触发执行
                        executeTask(taskId);
                    }
                });
        }
        
        // 找到初始可以执行的任务（没有依赖的任务）
        List<String> executionOrder = dag.topologicalSort();
        for (String taskId : executionOrder) {
            if (dependencyManager.canExecute(taskId)) {
                executeTask(taskId);
            }
        }
    }
}
```

## 工作流引擎（Azkaban、Airflow、DolphinScheduler）

### Apache Airflow

Apache Airflow 是一个使用 Python 编写的开源工作流管理平台，它使用 DAG 来定义工作流。

```python
# Airflow DAG 示例
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from datetime import datetime, timedelta

# 默认参数
default_args = {
    'owner': 'data_team',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# 定义 DAG
dag = DAG(
    'data_processing_workflow',
    default_args=default_args,
    description='数据处理工作流',
    schedule_interval=timedelta(days=1),
    catchup=False,
)

# 任务定义
def extract_data():
    print("执行数据抽取任务")
    # 实际的数据抽取逻辑

def transform_data():
    print("执行数据转换任务")
    # 实际的数据转换逻辑

def load_data():
    print("执行数据加载任务")
    # 实际的数据加载逻辑

def generate_report():
    print("生成报告")
    # 实际的报告生成逻辑

# 创建任务
extract_task = PythonOperator(
    task_id='extract_data',
    python_callable=extract_data,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_data',
    python_callable=load_data,
    dag=dag,
)

report_task = PythonOperator(
    task_id='generate_report',
    python_callable=generate_report,
    dag=dag,
)

# 定义依赖关系
extract_task >> transform_task >> load_task >> report_task
```

### Azkaban

Azkaban 是 LinkedIn 开源的一个批量工作流调度器，主要用于 Hadoop 作业的调度。

```properties
# Azkaban 作业配置文件 example.job
type=command
command=echo "执行数据处理任务"
dependencies=previous_job
```

```properties
# Azkaban 工作流配置文件 example.flow
nodes:
  - name: job1
    type: command
    command: echo "执行第一个任务"
  - name: job2
    type: command
    command: echo "执行第二个任务"
    dependsOn:
      - job1
  - name: job3
    type: command
    command: echo "执行第三个任务"
    dependsOn:
      - job2
```

### DolphinScheduler

DolphinScheduler 是一个分布式易扩展的可视化 DAG 工作流任务调度系统。

```java
// DolphinScheduler 任务定义示例
public class DolphinSchedulerExample {
    public static void main(String[] args) {
        // 创建工作流
        ProcessDefinition processDefinition = new ProcessDefinition();
        processDefinition.setName("数据处理工作流");
        processDefinition.setDescription("处理业务数据的工作流");
        
        // 创建任务节点
        TaskDefinition extractTask = new TaskDefinition();
        extractTask.setName("数据抽取");
        extractTask.setType(TaskType.SHELL);
        extractTask.setTaskParams("{\"rawScript\":\"echo '执行数据抽取'\"}");
        
        TaskDefinition transformTask = new TaskDefinition();
        transformTask.setName("数据转换");
        transformTask.setType(TaskType.SHELL);
        transformTask.setTaskParams("{\"rawScript\":\"echo '执行数据转换'\"}");
        
        TaskDefinition loadTask = new TaskDefinition();
        loadTask.setName("数据加载");
        loadTask.setType(TaskType.SHELL);
        loadTask.setTaskParams("{\"rawScript\":\"echo '执行数据加载'\"}");
        
        // 定义任务依赖关系
        ProcessTaskRelation relation1 = new ProcessTaskRelation();
        relation1.setPreTaskCode(extractTask.getCode());
        relation1.setPostTaskCode(transformTask.getCode());
        
        ProcessTaskRelation relation2 = new ProcessTaskRelation();
        relation2.setPreTaskCode(transformTask.getCode());
        relation2.setPostTaskCode(loadTask.getCode());
        
        // 构建工作流
        processDefinition.setTaskDefinitionList(Arrays.asList(extractTask, transformTask, loadTask));
        processDefinition.setProcessTaskRelationList(Arrays.asList(relation1, relation2));
        
        System.out.println("DolphinScheduler 工作流定义完成");
    }
}
```

## 总结

任务依赖与工作流调度是构建复杂业务系统的重要组成部分。通过 DAG 模型，我们可以清晰地表达任务间的依赖关系，并通过拓扑排序确定任务的执行顺序。

关键要点包括：

1. **DAG 模型**：使用有向无环图表示任务依赖关系，确保不会出现循环依赖
2. **依赖管理**：实时跟踪任务状态，确保下游任务在上游任务完成后才执行
3. **并行执行**：识别可以并行执行的任务组，提高执行效率
4. **工作流引擎**：使用成熟的开源工作流引擎（如 Airflow、Azkaban、DolphinScheduler）来管理复杂的工作流

在实际应用中，需要根据具体的业务需求选择合适的工作流引擎，并合理设计任务依赖关系，以确保工作流能够高效、可靠地执行。

在下一章中，我们将探讨任务执行与容错机制，包括重试机制、超时控制和幂等性保障等关键技术。