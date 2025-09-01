---
title: 调度平台的企业实践
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在企业级应用中，任务调度平台扮演着至关重要的角色。从电商系统的订单处理到金融行业的风险控制，从大数据处理到系统运维，调度平台无处不在。本文将深入探讨调度平台在企业中的典型应用场景，包括电商订单定时关闭、大数据ETL与批量计算、金融风控定时校验等，帮助读者理解如何在实际业务中有效应用调度技术。

## 电商订单定时关闭

在电商系统中，订单定时关闭是一个典型且重要的调度任务。用户下单后，如果在规定时间内未完成支付，系统需要自动关闭订单并释放相关资源。

### 业务场景分析

电商订单定时关闭涉及多个业务环节：

1. **订单创建**：用户下单后生成待支付订单
2. **支付超时监控**：监控订单支付状态，在超时后自动关闭
3. **资源释放**：释放库存、优惠券等资源
4. **通知处理**：发送订单关闭通知给用户

### 技术实现方案

```java
// 订单实体
public class Order {
    private String orderId;
    private String userId;
    private OrderStatus status;
    private BigDecimal amount;
    private LocalDateTime createTime;
    private LocalDateTime payDeadline;
    private List<OrderItem> items;
    private String couponCode;
    
    // constructors, getters and setters
    public Order(String orderId, String userId, BigDecimal amount) {
        this.orderId = orderId;
        this.userId = userId;
        this.amount = amount;
        this.status = OrderStatus.PENDING_PAYMENT;
        this.createTime = LocalDateTime.now();
        // 设置支付截止时间（30分钟后）
        this.payDeadline = this.createTime.plusMinutes(30);
    }
    
    public boolean isPaymentOverdue() {
        return status == OrderStatus.PENDING_PAYMENT && 
               LocalDateTime.now().isAfter(payDeadline);
    }
    
    // getters and setters
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getPayDeadline() { return payDeadline; }
    public void setPayDeadline(LocalDateTime payDeadline) { this.payDeadline = payDeadline; }
    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }
    public String getCouponCode() { return couponCode; }
    public void setCouponCode(String couponCode) { this.couponCode = couponCode; }
}

// 订单状态枚举
public enum OrderStatus {
    PENDING_PAYMENT,   // 待支付
    PAID,             // 已支付
    SHIPPED,          // 已发货
    COMPLETED,        // 已完成
    CANCELLED,        // 已取消
    CLOSED            // 已关闭
}

// 订单项
public class OrderItem {
    private String productId;
    private String productName;
    private int quantity;
    private BigDecimal price;
    
    // constructors, getters and setters
    public OrderItem(String productId, String productName, int quantity, BigDecimal price) {
        this.productId = productId;
        this.productName = productName;
        this.quantity = quantity;
        this.price = price;
    }
    
    // getters and setters
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
}

// 订单服务
public class OrderService {
    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final CouponService couponService;
    private final NotificationService notificationService;
    
    public OrderService(OrderRepository orderRepository, 
                       InventoryService inventoryService,
                       CouponService couponService,
                       NotificationService notificationService) {
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.couponService = couponService;
        this.notificationService = notificationService;
    }
    
    /**
     * 关闭超时未支付的订单
     */
    public void closeOverdueOrders() {
        List<Order> overdueOrders = orderRepository.findOverdueOrders();
        
        for (Order order : overdueOrders) {
            try {
                closeOrder(order);
                System.out.println("订单 " + order.getOrderId() + " 已关闭");
            } catch (Exception e) {
                System.err.println("关闭订单 " + order.getOrderId() + " 失败: " + e.getMessage());
            }
        }
    }
    
    /**
     * 关闭单个订单
     */
    private void closeOrder(Order order) {
        // 更新订单状态
        order.setStatus(OrderStatus.CLOSED);
        orderRepository.updateOrderStatus(order.getOrderId(), OrderStatus.CLOSED);
        
        // 释放库存
        releaseInventory(order);
        
        // 释放优惠券
        releaseCoupon(order);
        
        // 发送通知
        sendCloseNotification(order);
    }
    
    /**
     * 释放库存
     */
    private void releaseInventory(Order order) {
        for (OrderItem item : order.getItems()) {
            inventoryService.releaseStock(item.getProductId(), item.getQuantity());
        }
    }
    
    /**
     * 释放优惠券
     */
    private void releaseCoupon(Order order) {
        if (order.getCouponCode() != null && !order.getCouponCode().isEmpty()) {
            couponService.releaseCoupon(order.getCouponCode(), order.getUserId());
        }
    }
    
    /**
     * 发送关闭通知
     */
    private void sendCloseNotification(Order order) {
        String message = "您的订单 " + order.getOrderId() + " 因超时未支付已被关闭";
        notificationService.sendNotification(order.getUserId(), message);
    }
}

// 订单仓库接口
public interface OrderRepository {
    List<Order> findOverdueOrders();
    void updateOrderStatus(String orderId, OrderStatus status);
    Order findById(String orderId);
}

// 库存服务
public class InventoryService {
    private final InventoryRepository inventoryRepository;
    
    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }
    
    /**
     * 释放库存
     */
    public void releaseStock(String productId, int quantity) {
        inventoryRepository.increaseStock(productId, quantity);
        System.out.println("释放商品 " + productId + " 库存: " + quantity);
    }
}

// 优惠券服务
public class CouponService {
    private final CouponRepository couponRepository;
    
    public CouponService(CouponRepository couponRepository) {
        this.couponRepository = couponRepository;
    }
    
    /**
     * 释放优惠券
     */
    public void releaseCoupon(String couponCode, String userId) {
        couponRepository.releaseCoupon(couponCode, userId);
        System.out.println("释放优惠券: " + couponCode);
    }
}

// 通知服务
public class NotificationService {
    /**
     * 发送通知
     */
    public void sendNotification(String userId, String message) {
        // 实际实现可能是发送短信、邮件或站内信
        System.out.println("发送通知给用户 " + userId + ": " + message);
    }
}
```

### 调度任务配置

```java
// 订单关闭调度任务
@Component
public class OrderCloseJob implements Job {
    private static final Logger logger = LoggerFactory.getLogger(OrderCloseJob.class);
    
    @Autowired
    private OrderService orderService;
    
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        try {
            logger.info("开始执行订单关闭任务");
            long startTime = System.currentTimeMillis();
            
            orderService.closeOverdueOrders();
            
            long endTime = System.currentTimeMillis();
            logger.info("订单关闭任务执行完成，耗时: {}ms", (endTime - startTime));
        } catch (Exception e) {
            logger.error("订单关闭任务执行失败", e);
            throw new JobExecutionException("订单关闭任务执行失败", e);
        }
    }
}

// 调度配置
@Configuration
public class OrderSchedulingConfig {
    
    @Bean
    public JobDetail orderCloseJobDetail() {
        return JobBuilder.newJob(OrderCloseJob.class)
            .withIdentity("orderCloseJob")
            .withDescription("订单超时关闭任务")
            .storeDurably()
            .build();
    }
    
    @Bean
    public Trigger orderCloseJobTrigger() {
        // 每分钟执行一次
        CronScheduleBuilder scheduleBuilder = CronScheduleBuilder.cronSchedule("0 * * * * ?");
        
        return TriggerBuilder.newTrigger()
            .forJob(orderCloseJobDetail())
            .withIdentity("orderCloseJobTrigger")
            .withDescription("订单超时关闭触发器")
            .withSchedule(scheduleBuilder)
            .build();
    }
}
```

### 性能优化考虑

```java
// 批量处理订单关闭
public class BatchOrderCloseService {
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final int batchSize = 100; // 批处理大小
    
    public void closeOverdueOrdersInBatch() {
        int offset = 0;
        List<Order> batch;
        
        do {
            batch = orderRepository.findOverdueOrders(offset, batchSize);
            
            // 并行处理批次
            batch.parallelStream().forEach(order -> {
                try {
                    orderService.closeOrder(order);
                } catch (Exception e) {
                    System.err.println("关闭订单 " + order.getOrderId() + " 失败: " + e.getMessage());
                }
            });
            
            offset += batchSize;
        } while (batch.size() == batchSize);
    }
}

// 分布式锁防止重复执行
public class DistributedOrderCloseService {
    private final OrderService orderService;
    private final DistributedLock distributedLock;
    private final String lockKey = "order_close_lock";
    private final int lockTimeoutSeconds = 300; // 5分钟
    
    public void closeOverdueOrdersWithLock() {
        String lockValue = UUID.randomUUID().toString();
        
        if (distributedLock.tryLock(lockKey, lockValue, lockTimeoutSeconds)) {
            try {
                orderService.closeOverdueOrders();
            } finally {
                distributedLock.releaseLock(lockKey, lockValue);
            }
        } else {
            System.out.println("获取订单关闭锁失败，可能已有其他节点在执行");
        }
    }
}
```

## 大数据 ETL 与批量计算

在大数据处理场景中，ETL（Extract, Transform, Load）和批量计算任务是调度平台的核心应用之一。这些任务通常涉及海量数据的处理，对性能和可靠性要求极高。

### ETL 任务架构

```java
// ETL 任务配置
public class EtlTaskConfig {
    private String taskId;
    private String sourceType; // 数据源类型：DATABASE, FILE, API
    private String sourceConfig; // 数据源配置
    private String transformLogic; // 转换逻辑
    private String targetConfig; // 目标配置
    private String scheduleCron; // 调度表达式
    private int retryCount; // 重试次数
    private long timeoutMs; // 超时时间
    
    // constructors, getters and setters
    public EtlTaskConfig(String taskId, String sourceType, String sourceConfig, 
                        String transformLogic, String targetConfig) {
        this.taskId = taskId;
        this.sourceType = sourceType;
        this.sourceConfig = sourceConfig;
        this.transformLogic = transformLogic;
        this.targetConfig = targetConfig;
        this.retryCount = 3;
        this.timeoutMs = 3600000; // 1小时
    }
    
    // getters and setters
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getSourceConfig() { return sourceConfig; }
    public void setSourceConfig(String sourceConfig) { this.sourceConfig = sourceConfig; }
    public String getTransformLogic() { return transformLogic; }
    public void setTransformLogic(String transformLogic) { this.transformLogic = transformLogic; }
    public String getTargetConfig() { return targetConfig; }
    public void setTargetConfig(String targetConfig) { this.targetConfig = targetConfig; }
    public String getScheduleCron() { return scheduleCron; }
    public void setScheduleCron(String scheduleCron) { this.scheduleCron = scheduleCron; }
    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public long getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(long timeoutMs) { this.timeoutMs = timeoutMs; }
}

// ETL 任务执行器
public class EtlTaskExecutor {
    private final DataSourceManager dataSourceManager;
    private final DataTransformer dataTransformer;
    private final DataTargetManager dataTargetManager;
    private final TaskExecutionMonitor executionMonitor;
    
    public EtlTaskExecutor(DataSourceManager dataSourceManager,
                          DataTransformer dataTransformer,
                          DataTargetManager dataTargetManager,
                          TaskExecutionMonitor executionMonitor) {
        this.dataSourceManager = dataSourceManager;
        this.dataTransformer = dataTransformer;
        this.dataTargetManager = dataTargetManager;
        this.executionMonitor = executionMonitor;
    }
    
    /**
     * 执行 ETL 任务
     */
    public EtlTaskResult executeEtlTask(EtlTaskConfig config) {
        long startTime = System.currentTimeMillis();
        String taskId = config.getTaskId();
        
        try {
            executionMonitor.recordTaskStart(taskId);
            
            // 1. 提取数据
            List<DataRecord> extractedData = extractData(config);
            
            // 2. 转换数据
            List<DataRecord> transformedData = transformData(config, extractedData);
            
            // 3. 加载数据
            loadData(config, transformedData);
            
            long endTime = System.currentTimeMillis();
            executionMonitor.recordTaskSuccess(taskId, endTime - startTime);
            
            return EtlTaskResult.success(taskId, transformedData.size(), endTime - startTime);
        } catch (Exception e) {
            long endTime = System.currentTimeMillis();
            executionMonitor.recordTaskFailure(taskId, e, endTime - startTime);
            
            return EtlTaskResult.failure(taskId, e.getMessage(), endTime - startTime);
        }
    }
    
    /**
     * 提取数据
     */
    private List<DataRecord> extractData(EtlTaskConfig config) throws Exception {
        DataSource dataSource = dataSourceManager.createDataSource(config.getSourceType(), config.getSourceConfig());
        return dataSource.extractData();
    }
    
    /**
     * 转换数据
     */
    private List<DataRecord> transformData(EtlTaskConfig config, List<DataRecord> data) throws Exception {
        return dataTransformer.transform(config.getTransformLogic(), data);
    }
    
    /**
     * 加载数据
     */
    private void loadData(EtlTaskConfig config, List<DataRecord> data) throws Exception {
        DataTarget dataTarget = dataTargetManager.createDataTarget(config.getTargetConfig());
        dataTarget.loadData(data);
    }
}

// 数据源管理器
public class DataSourceManager {
    public DataSource createDataSource(String type, String config) throws Exception {
        switch (type.toUpperCase()) {
            case "DATABASE":
                return new DatabaseDataSource(config);
            case "FILE":
                return new FileDataSource(config);
            case "API":
                return new ApiDataSource(config);
            default:
                throw new IllegalArgumentException("不支持的数据源类型: " + type);
        }
    }
}

// 数据源接口
public interface DataSource {
    List<DataRecord> extractData() throws Exception;
}

// 数据库数据源
public class DatabaseDataSource implements DataSource {
    private final String connectionUrl;
    private final String query;
    
    public DatabaseDataSource(String config) {
        // 解析配置
        JSONObject configJson = JSON.parseObject(config);
        this.connectionUrl = configJson.getString("url");
        this.query = configJson.getString("query");
    }
    
    @Override
    public List<DataRecord> extractData() throws Exception {
        List<DataRecord> records = new ArrayList<>();
        
        try (Connection conn = DriverManager.getConnection(connectionUrl);
             PreparedStatement stmt = conn.prepareStatement(query);
             ResultSet rs = stmt.executeQuery()) {
            
            while (rs.next()) {
                DataRecord record = new DataRecord();
                // 假设查询返回 id, name, value 三列
                record.addField("id", rs.getString("id"));
                record.addField("name", rs.getString("name"));
                record.addField("value", rs.getString("value"));
                records.add(record);
            }
        }
        
        return records;
    }
}

// 文件数据源
public class FileDataSource implements DataSource {
    private final String filePath;
    private final String fileType;
    
    public FileDataSource(String config) {
        JSONObject configJson = JSON.parseObject(config);
        this.filePath = configJson.getString("path");
        this.fileType = configJson.getString("type"); // CSV, JSON, XML
    }
    
    @Override
    public List<DataRecord> extractData() throws Exception {
        switch (fileType.toUpperCase()) {
            case "CSV":
                return readCsvFile(filePath);
            case "JSON":
                return readJsonFile(filePath);
            default:
                throw new IllegalArgumentException("不支持的文件类型: " + fileType);
        }
    }
    
    private List<DataRecord> readCsvFile(String filePath) throws Exception {
        List<DataRecord> records = new ArrayList<>();
        // 实现 CSV 文件读取逻辑
        return records;
    }
    
    private List<DataRecord> readJsonFile(String filePath) throws Exception {
        List<DataRecord> records = new ArrayList<>();
        // 实现 JSON 文件读取逻辑
        return records;
    }
}

// API 数据源
public class ApiDataSource implements DataSource {
    private final String apiUrl;
    private final Map<String, String> headers;
    
    public ApiDataSource(String config) {
        JSONObject configJson = JSON.parseObject(config);
        this.apiUrl = configJson.getString("url");
        this.headers = JSON.parseObject(configJson.getString("headers"), Map.class);
    }
    
    @Override
    public List<DataRecord> extractData() throws Exception {
        // 实现 API 调用逻辑
        return new ArrayList<>();
    }
}

// 数据记录
public class DataRecord {
    private final Map<String, Object> fields = new HashMap<>();
    
    public void addField(String name, Object value) {
        fields.put(name, value);
    }
    
    public Object getField(String name) {
        return fields.get(name);
    }
    
    public Set<String> getFieldNames() {
        return fields.keySet();
    }
    
    public Map<String, Object> getFields() {
        return new HashMap<>(fields);
    }
}

// 数据转换器
public class DataTransformer {
    public List<DataRecord> transform(String transformLogic, List<DataRecord> data) throws Exception {
        // 简化实现，实际应用中可能使用脚本引擎或规则引擎
        List<DataRecord> transformedData = new ArrayList<>();
        
        for (DataRecord record : data) {
            DataRecord transformedRecord = applyTransformLogic(transformLogic, record);
            transformedData.add(transformedRecord);
        }
        
        return transformedData;
    }
    
    private DataRecord applyTransformLogic(String transformLogic, DataRecord record) {
        // 这里应该实现具体的转换逻辑
        // 可能包括字段映射、数据清洗、格式转换等
        return record;
    }
}

// 数据目标管理器
public class DataTargetManager {
    public DataTarget createDataTarget(String config) throws Exception {
        JSONObject configJson = JSON.parseObject(config);
        String type = configJson.getString("type");
        
        switch (type.toUpperCase()) {
            case "DATABASE":
                return new DatabaseDataTarget(config);
            case "FILE":
                return new FileDataTarget(config);
            case "WAREHOUSE":
                return new DataWarehouseTarget(config);
            default:
                throw new IllegalArgumentException("不支持的数据目标类型: " + type);
        }
    }
}

// 数据目标接口
public interface DataTarget {
    void loadData(List<DataRecord> data) throws Exception;
}

// 数据库数据目标
public class DatabaseDataTarget implements DataTarget {
    private final String connectionUrl;
    private final String tableName;
    
    public DatabaseDataTarget(String config) {
        JSONObject configJson = JSON.parseObject(config);
        this.connectionUrl = configJson.getString("url");
        this.tableName = configJson.getString("table");
    }
    
    @Override
    public void loadData(List<DataRecord> data) throws Exception {
        // 批量插入数据到数据库
        try (Connection conn = DriverManager.getConnection(connectionUrl)) {
            conn.setAutoCommit(false);
            
            String insertSql = generateInsertSql(tableName, data.get(0));
            try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                for (DataRecord record : data) {
                    bindRecordToStatement(stmt, record);
                    stmt.addBatch();
                }
                stmt.executeBatch();
            }
            
            conn.commit();
        }
    }
    
    private String generateInsertSql(String tableName, DataRecord sampleRecord) {
        StringBuilder sql = new StringBuilder("INSERT INTO ");
        sql.append(tableName).append(" (");
        
        List<String> fieldNames = new ArrayList<>(sampleRecord.getFieldNames());
        sql.append(String.join(", ", fieldNames));
        sql.append(") VALUES (");
        sql.append(fieldNames.stream().map(f -> "?").collect(Collectors.joining(", ")));
        sql.append(")");
        
        return sql.toString();
    }
    
    private void bindRecordToStatement(PreparedStatement stmt, DataRecord record) throws SQLException {
        int index = 1;
        for (String fieldName : record.getFieldNames()) {
            stmt.setObject(index++, record.getField(fieldName));
        }
    }
}

// ETL 任务结果
public class EtlTaskResult {
    private final String taskId;
    private final boolean success;
    private final String message;
    private final int recordCount;
    private final long executionTimeMs;
    private final LocalDateTime executionTime;
    
    private EtlTaskResult(String taskId, boolean success, String message, 
                         int recordCount, long executionTimeMs) {
        this.taskId = taskId;
        this.success = success;
        this.message = message;
        this.recordCount = recordCount;
        this.executionTimeMs = executionTimeMs;
        this.executionTime = LocalDateTime.now();
    }
    
    public static EtlTaskResult success(String taskId, int recordCount, long executionTimeMs) {
        return new EtlTaskResult(taskId, true, "任务执行成功", recordCount, executionTimeMs);
    }
    
    public static EtlTaskResult failure(String taskId, String message, long executionTimeMs) {
        return new EtlTaskResult(taskId, false, message, 0, executionTimeMs);
    }
    
    // getters
    public String getTaskId() { return taskId; }
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public int getRecordCount() { return recordCount; }
    public long getExecutionTimeMs() { return executionTimeMs; }
    public LocalDateTime getExecutionTime() { return executionTime; }
}

// 任务执行监控器
public class TaskExecutionMonitor {
    private final MeterRegistry meterRegistry;
    
    public TaskExecutionMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordTaskStart(String taskId) {
        Counter.builder("etl.task.start")
            .tag("task", taskId)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordTaskSuccess(String taskId, long durationMs) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("etl.task.duration")
            .tag("task", taskId)
            .tag("status", "success")
            .register(meterRegistry));
        
        Counter.builder("etl.task.success")
            .tag("task", taskId)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordTaskFailure(String taskId, Exception error, long durationMs) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("etl.task.duration")
            .tag("task", taskId)
            .tag("status", "failure")
            .register(meterRegistry));
        
        Counter.builder("etl.task.failure")
            .tag("task", taskId)
            .tag("error", error.getClass().getSimpleName())
            .register(meterRegistry)
            .increment();
    }
}
```

### 大数据批量计算任务

```java
// 批量计算任务
public class BatchCalculationJob implements Job {
    private static final Logger logger = LoggerFactory.getLogger(BatchCalculationJob.class);
    
    @Autowired
    private EtlTaskExecutor etlTaskExecutor;
    
    @Autowired
    private EtlTaskConfigRepository configRepository;
    
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        String taskId = context.getJobDetail().getKey().getName();
        
        try {
            logger.info("开始执行批量计算任务: {}", taskId);
            long startTime = System.currentTimeMillis();
            
            // 获取任务配置
            EtlTaskConfig config = configRepository.findByTaskId(taskId);
            if (config == null) {
                throw new JobExecutionException("未找到任务配置: " + taskId);
            }
            
            // 执行 ETL 任务
            EtlTaskResult result = etlTaskExecutor.executeEtlTask(config);
            
            long endTime = System.currentTimeMillis();
            logger.info("批量计算任务 {} 执行完成，处理记录数: {}，耗时: {}ms", 
                       taskId, result.getRecordCount(), (endTime - startTime));
            
            if (!result.isSuccess()) {
                throw new JobExecutionException("任务执行失败: " + result.getMessage());
            }
        } catch (Exception e) {
            logger.error("批量计算任务 {} 执行失败", taskId, e);
            throw new JobExecutionException("任务执行失败", e);
        }
    }
}

// 分布式批量处理
public class DistributedBatchProcessor {
    private final EtlTaskExecutor etlTaskExecutor;
    private final TaskPartitioner taskPartitioner;
    private final DistributedLock distributedLock;
    
    public DistributedBatchProcessor(EtlTaskExecutor etlTaskExecutor,
                                   TaskPartitioner taskPartitioner,
                                   DistributedLock distributedLock) {
        this.etlTaskExecutor = etlTaskExecutor;
        this.taskPartitioner = taskPartitioner;
        this.distributedLock = distributedLock;
    }
    
    /**
     * 分布式执行批量任务
     */
    public List<EtlTaskResult> executeDistributedBatch(EtlTaskConfig config) {
        // 分割任务
        List<EtlTaskConfig> partitions = taskPartitioner.partitionTask(config, 5); // 分成5个分区
        
        // 并行执行分区任务
        List<CompletableFuture<EtlTaskResult>> futures = new ArrayList<>();
        
        for (EtlTaskConfig partitionConfig : partitions) {
            CompletableFuture<EtlTaskResult> future = CompletableFuture.supplyAsync(() -> {
                return etlTaskExecutor.executeEtlTask(partitionConfig);
            });
            futures.add(future);
        }
        
        // 等待所有分区完成
        CompletableFuture<Void> allDone = CompletableFuture.allOf(
            futures.toArray(new CompletableFuture[0]));
        
        try {
            allDone.get(3600, TimeUnit.SECONDS); // 1小时超时
            
            List<EtlTaskResult> results = new ArrayList<>();
            for (CompletableFuture<EtlTaskResult> future : futures) {
                results.add(future.get());
            }
            
            return results;
        } catch (Exception e) {
            throw new RuntimeException("分布式批量处理失败", e);
        }
    }
}

// 任务分割器
public class TaskPartitioner {
    /**
     * 将任务分割成多个分区
     */
    public List<EtlTaskConfig> partitionTask(EtlTaskConfig originalConfig, int partitionCount) {
        List<EtlTaskConfig> partitions = new ArrayList<>();
        
        for (int i = 0; i < partitionCount; i++) {
            EtlTaskConfig partitionConfig = new EtlTaskConfig(
                originalConfig.getTaskId() + "_partition_" + i,
                originalConfig.getSourceType(),
                modifySourceConfigForPartition(originalConfig.getSourceConfig(), i, partitionCount),
                originalConfig.getTransformLogic(),
                originalConfig.getTargetConfig()
            );
            partitionConfig.setScheduleCron(originalConfig.getScheduleCron());
            partitionConfig.setRetryCount(originalConfig.getRetryCount());
            partitionConfig.setTimeoutMs(originalConfig.getTimeoutMs() / partitionCount);
            
            partitions.add(partitionConfig);
        }
        
        return partitions;
    }
    
    /**
     * 修改数据源配置以适应分区
     */
    private String modifySourceConfigForPartition(String sourceConfig, int partitionIndex, int partitionCount) {
        JSONObject configJson = JSON.parseObject(sourceConfig);
        
        // 根据数据源类型修改配置
        String sourceType = configJson.getString("type");
        switch (sourceType.toUpperCase()) {
            case "DATABASE":
                // 添加分页或分区条件
                String query = configJson.getString("query");
                String partitionedQuery = addPartitionCondition(query, partitionIndex, partitionCount);
                configJson.put("query", partitionedQuery);
                break;
            case "FILE":
                // 修改文件路径以处理不同分区的文件
                String filePath = configJson.getString("path");
                String partitionedPath = addPartitionToPath(filePath, partitionIndex);
                configJson.put("path", partitionedPath);
                break;
        }
        
        return configJson.toJSONString();
    }
    
    private String addPartitionCondition(String query, int partitionIndex, int partitionCount) {
        // 简化实现，实际应用中需要根据具体业务逻辑添加分区条件
        return query + " LIMIT " + (partitionIndex * 1000) + ", 1000";
    }
    
    private String addPartitionToPath(String filePath, int partitionIndex) {
        // 简化实现，实际应用中需要根据具体文件结构添加分区标识
        int lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex > 0) {
            return filePath.substring(0, lastDotIndex) + "_part" + partitionIndex + 
                   filePath.substring(lastDotIndex);
        } else {
            return filePath + "_part" + partitionIndex;
        }
    }
}
```

## 金融风控定时校验

在金融行业，风险控制是业务运营的核心环节。定时进行风险校验、数据核对和异常检测是保障业务安全的重要手段。

### 风控校验任务架构

```java
// 风控校验任务
public class RiskControlVerificationJob implements Job {
    private static final Logger logger = LoggerFactory.getLogger(RiskControlVerificationJob.class);
    
    @Autowired
    private RiskControlService riskControlService;
    
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        try {
            logger.info("开始执行风控校验任务");
            long startTime = System.currentTimeMillis();
            
            // 执行风控校验
            RiskVerificationResult result = riskControlService.performRiskVerification();
            
            long endTime = System.currentTimeMillis();
            logger.info("风控校验任务执行完成，耗时: {}ms，发现风险项: {}", 
                       (endTime - startTime), result.getRiskItemCount());
            
            // 如果发现风险，发送告警
            if (result.hasRisks()) {
                sendRiskAlert(result);
            }
        } catch (Exception e) {
            logger.error("风控校验任务执行失败", e);
            throw new JobExecutionException("风控校验任务执行失败", e);
        }
    }
    
    private void sendRiskAlert(RiskVerificationResult result) {
        // 发送告警通知
        String alertMessage = "风控校验发现 " + result.getRiskItemCount() + " 个风险项";
        // 实际实现可能包括邮件、短信、电话等多种通知方式
        System.out.println("发送风控告警: " + alertMessage);
    }
}

// 风控校验结果
public class RiskVerificationResult {
    private final List<RiskItem> riskItems;
    private final LocalDateTime verificationTime;
    private final long executionTimeMs;
    
    public RiskVerificationResult(List<RiskItem> riskItems, long executionTimeMs) {
        this.riskItems = new ArrayList<>(riskItems);
        this.verificationTime = LocalDateTime.now();
        this.executionTimeMs = executionTimeMs;
    }
    
    public boolean hasRisks() {
        return !riskItems.isEmpty();
    }
    
    public int getRiskItemCount() {
        return riskItems.size();
    }
    
    // getters
    public List<RiskItem> getRiskItems() { return new ArrayList<>(riskItems); }
    public LocalDateTime getVerificationTime() { return verificationTime; }
    public long getExecutionTimeMs() { return executionTimeMs; }
}

// 风险项
public class RiskItem {
    private final String itemId;
    private final RiskType riskType;
    private final String description;
    private final RiskLevel riskLevel;
    private final Map<String, Object> details;
    private final LocalDateTime detectedTime;
    
    public RiskItem(String itemId, RiskType riskType, String description, 
                   RiskLevel riskLevel, Map<String, Object> details) {
        this.itemId = itemId;
        this.riskType = riskType;
        this.description = description;
        this.riskLevel = riskLevel;
        this.details = new HashMap<>(details);
        this.detectedTime = LocalDateTime.now();
    }
    
    // getters
    public String getItemId() { return itemId; }
    public RiskType getRiskType() { return riskType; }
    public String getDescription() { return description; }
    public RiskLevel getRiskLevel() { return riskLevel; }
    public Map<String, Object> getDetails() { return new HashMap<>(details); }
    public LocalDateTime getDetectedTime() { return detectedTime; }
}

// 风险类型枚举
public enum RiskType {
    TRANSACTION_ANOMALY,    // 交易异常
    ACCOUNT_BEHAVIOR,       // 账户行为异常
    DATA_INCONSISTENCY,     // 数据不一致
    COMPLIANCE_VIOLATION,   // 合规违规
    SYSTEM_INTEGRITY        // 系统完整性
}

// 风险等级枚举
public enum RiskLevel {
    LOW,    // 低风险
    MEDIUM, // 中风险
    HIGH,   // 高风险
    CRITICAL // 关键风险
}

// 风控服务
public class RiskControlService {
    private final List<RiskVerificationRule> verificationRules;
    private final RiskItemRepository riskItemRepository;
    private final AuditService auditService;
    
    public RiskControlService(List<RiskVerificationRule> verificationRules,
                             RiskItemRepository riskItemRepository,
                             AuditService auditService) {
        this.verificationRules = new ArrayList<>(verificationRules);
        this.riskItemRepository = riskItemRepository;
        this.auditService = auditService;
    }
    
    /**
     * 执行风控校验
     */
    public RiskVerificationResult performRiskVerification() {
        long startTime = System.currentTimeMillis();
        List<RiskItem> detectedRisks = new ArrayList<>();
        
        // 并行执行所有校验规则
        List<CompletableFuture<List<RiskItem>>> futures = new ArrayList<>();
        
        for (RiskVerificationRule rule : verificationRules) {
            CompletableFuture<List<RiskItem>> future = CompletableFuture.supplyAsync(() -> {
                try {
                    return rule.verify();
                } catch (Exception e) {
                    System.err.println("风控规则 " + rule.getRuleName() + " 执行失败: " + e.getMessage());
                    return new ArrayList<RiskItem>();
                }
            });
            futures.add(future);
        }
        
        // 等待所有规则执行完成
        CompletableFuture<Void> allDone = CompletableFuture.allOf(
            futures.toArray(new CompletableFuture[0]));
        
        try {
            allDone.get(300, TimeUnit.SECONDS); // 5分钟超时
            
            for (CompletableFuture<List<RiskItem>> future : futures) {
                detectedRisks.addAll(future.get());
            }
        } catch (Exception e) {
            throw new RuntimeException("风控校验执行失败", e);
        }
        
        // 保存发现的风险项
        for (RiskItem riskItem : detectedRisks) {
            riskItemRepository.save(riskItem);
        }
        
        // 记录审计日志
        auditService.logRiskVerification(detectedRisks.size());
        
        long endTime = System.currentTimeMillis();
        return new RiskVerificationResult(detectedRisks, endTime - startTime);
    }
}

// 风控校验规则接口
public interface RiskVerificationRule {
    String getRuleName();
    String getDescription();
    List<RiskItem> verify() throws Exception;
}

// 交易异常检测规则
public class TransactionAnomalyRule implements RiskVerificationRule {
    private final TransactionRepository transactionRepository;
    private final double threshold = 10000.0; // 交易金额阈值
    
    public TransactionAnomalyRule(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }
    
    @Override
    public String getRuleName() {
        return "TransactionAnomalyRule";
    }
    
    @Override
    public String getDescription() {
        return "检测异常交易行为";
    }
    
    @Override
    public List<RiskItem> verify() throws Exception {
        List<RiskItem> riskItems = new ArrayList<>();
        
        // 获取最近的交易记录
        List<Transaction> recentTransactions = transactionRepository.findRecentTransactions(1000);
        
        for (Transaction transaction : recentTransactions) {
            // 检测大额交易
            if (transaction.getAmount().compareTo(BigDecimal.valueOf(threshold)) > 0) {
                Map<String, Object> details = new HashMap<>();
                details.put("transactionId", transaction.getId());
                details.put("amount", transaction.getAmount());
                details.put("accountId", transaction.getAccountId());
                
                RiskItem riskItem = new RiskItem(
                    "TXN_" + transaction.getId(),
                    RiskType.TRANSACTION_ANOMALY,
                    "检测到大额交易",
                    RiskLevel.HIGH,
                    details
                );
                riskItems.add(riskItem);
            }
            
            // 检测频繁交易
            if (isFrequentTransaction(transaction.getAccountId())) {
                Map<String, Object> details = new HashMap<>();
                details.put("accountId", transaction.getAccountId());
                details.put("transactionCount", getTransactionCount(transaction.getAccountId()));
                
                RiskItem riskItem = new RiskItem(
                    "FREQ_" + transaction.getAccountId(),
                    RiskType.TRANSACTION_ANOMALY,
                    "检测到频繁交易行为",
                    RiskLevel.MEDIUM,
                    details
                );
                riskItems.add(riskItem);
            }
        }
        
        return riskItems;
    }
    
    private boolean isFrequentTransaction(String accountId) {
        // 检查账户是否在短时间内有大量交易
        return getTransactionCount(accountId) > 10; // 10笔以上认为是频繁交易
    }
    
    private int getTransactionCount(String accountId) {
        // 获取账户最近的交易数量
        return transactionRepository.getTransactionCount(accountId, LocalDateTime.now().minusHours(1));
    }
}

// 数据一致性校验规则
public class DataConsistencyRule implements RiskVerificationRule {
    private final DataConsistencyChecker consistencyChecker;
    
    public DataConsistencyRule(DataConsistencyChecker consistencyChecker) {
        this.consistencyChecker = consistencyChecker;
    }
    
    @Override
    public String getRuleName() {
        return "DataConsistencyRule";
    }
    
    @Override
    public String getDescription() {
        return "检测数据一致性问题";
    }
    
    @Override
    public List<RiskItem> verify() throws Exception {
        List<RiskItem> riskItems = new ArrayList<>();
        
        // 执行数据一致性检查
        List<Inconsistency> inconsistencies = consistencyChecker.checkConsistency();
        
        for (Inconsistency inconsistency : inconsistencies) {
            Map<String, Object> details = new HashMap<>();
            details.put("tableName", inconsistency.getTableName());
            details.put("inconsistencyType", inconsistency.getType());
            details.put("description", inconsistency.getDescription());
            
            RiskItem riskItem = new RiskItem(
                "INCON_" + UUID.randomUUID().toString(),
                RiskType.DATA_INCONSISTENCY,
                "检测到数据不一致",
                RiskLevel.MEDIUM,
                details
            );
            riskItems.add(riskItem);
        }
        
        return riskItems;
    }
}

// 交易实体
public class Transaction {
    private String id;
    private String accountId;
    private BigDecimal amount;
    private LocalDateTime transactionTime;
    private TransactionType type;
    
    // constructors, getters and setters
    public Transaction(String id, String accountId, BigDecimal amount, TransactionType type) {
        this.id = id;
        this.accountId = accountId;
        this.amount = amount;
        this.transactionTime = LocalDateTime.now();
        this.type = type;
    }
    
    // getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAccountId() { return accountId; }
    public void setAccountId(String accountId) { this.accountId = accountId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDateTime getTransactionTime() { return transactionTime; }
    public void setTransactionTime(LocalDateTime transactionTime) { this.transactionTime = transactionTime; }
    public TransactionType getType() { return type; }
    public void setType(TransactionType type) { this.type = type; }
}

// 交易类型枚举
public enum TransactionType {
    DEPOSIT,    // 存款
    WITHDRAWAL, // 取款
    TRANSFER,   // 转账
    PAYMENT     // 支付
}

// 数据不一致项
public class Inconsistency {
    private String tableName;
    private String type;
    private String description;
    
    public Inconsistency(String tableName, String type, String description) {
        this.tableName = tableName;
        this.type = type;
        this.description = description;
    }
    
    // getters
    public String getTableName() { return tableName; }
    public String getType() { return type; }
    public String getDescription() { return description; }
}

// 数据一致性检查器
public class DataConsistencyChecker {
    private final DataSource dataSource1;
    private final DataSource dataSource2;
    
    public DataConsistencyChecker(DataSource dataSource1, DataSource dataSource2) {
        this.dataSource1 = dataSource1;
        this.dataSource2 = dataSource2;
    }
    
    /**
     * 检查数据一致性
     */
    public List<Inconsistency> checkConsistency() throws Exception {
        List<Inconsistency> inconsistencies = new ArrayList<>();
        
        // 检查账户余额一致性
        checkAccountBalanceConsistency(inconsistencies);
        
        // 检查交易记录一致性
        checkTransactionConsistency(inconsistencies);
        
        return inconsistencies;
    }
    
    private void checkAccountBalanceConsistency(List<Inconsistency> inconsistencies) throws Exception {
        // 从两个数据源获取账户余额并比较
        Map<String, BigDecimal> balances1 = getAccountBalances(dataSource1);
        Map<String, BigDecimal> balances2 = getAccountBalances(dataSource2);
        
        for (Map.Entry<String, BigDecimal> entry : balances1.entrySet()) {
            String accountId = entry.getKey();
            BigDecimal balance1 = entry.getValue();
            BigDecimal balance2 = balances2.get(accountId);
            
            if (balance2 == null || balance1.compareTo(balance2) != 0) {
                inconsistencies.add(new Inconsistency(
                    "account_balance",
                    "BALANCE_MISMATCH",
                    "账户 " + accountId + " 余额不一致: " + balance1 + " vs " + balance2
                ));
            }
        }
    }
    
    private void checkTransactionConsistency(List<Inconsistency> inconsistencies) throws Exception {
        // 检查交易记录一致性
        // 实现具体的检查逻辑
    }
    
    private Map<String, BigDecimal> getAccountBalances(DataSource dataSource) throws Exception {
        // 从数据源获取账户余额
        return new HashMap<>();
    }
}

// 风控仓库接口
public interface RiskItemRepository {
    void save(RiskItem riskItem);
    List<RiskItem> findRecentRiskItems(int limit);
    List<RiskItem> findRiskItemsByLevel(RiskLevel level);
}

// 审计服务
public class AuditService {
    private final AuditLogRepository auditLogRepository;
    
    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    
    /**
     * 记录风控校验日志
     */
    public void logRiskVerification(int riskItemCount) {
        AuditLog log = new AuditLog();
        log.setAction("RISK_VERIFICATION");
        log.setDetails("发现风险项数量: " + riskItemCount);
        log.setTimestamp(LocalDateTime.now());
        
        auditLogRepository.save(log);
    }
}

// 审计日志
public class AuditLog {
    private String id;
    private String action;
    private String details;
    private LocalDateTime timestamp;
    
    // constructors, getters and setters
    public AuditLog() {
        this.id = UUID.randomUUID().toString();
        this.timestamp = LocalDateTime.now();
    }
    
    // getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}

// 审计日志仓库接口
public interface AuditLogRepository {
    void save(AuditLog log);
    List<AuditLog> findRecentLogs(int limit);
}
```

### 风控调度配置

```java
// 风控调度配置
@Configuration
public class RiskControlSchedulingConfig {
    
    @Bean
    public JobDetail riskControlJobDetail() {
        return JobBuilder.newJob(RiskControlVerificationJob.class)
            .withIdentity("riskControlJob")
            .withDescription("金融风控定时校验任务")
            .storeDurably()
            .build();
    }
    
    @Bean
    public Trigger riskControlJobTrigger() {
        // 每小时执行一次
        CronScheduleBuilder scheduleBuilder = CronScheduleBuilder.cronSchedule("0 0 * * * ?");
        
        return TriggerBuilder.newTrigger()
            .forJob(riskControlJobDetail())
            .withIdentity("riskControlJobTrigger")
            .withDescription("金融风控定时校验触发器")
            .withSchedule(scheduleBuilder)
            .build();
    }
    
    @Bean
    public JobDetail highRiskAlertJobDetail() {
        return JobBuilder.newJob(HighRiskAlertJob.class)
            .withIdentity("highRiskAlertJob")
            .withDescription("高风险告警任务")
            .storeDurably()
            .build();
    }
    
    @Bean
    public Trigger highRiskAlertJobTrigger() {
        // 每10分钟检查一次高风险项
        CronScheduleBuilder scheduleBuilder = CronScheduleBuilder.cronSchedule("0 */10 * * * ?");
        
        return TriggerBuilder.newTrigger()
            .forJob(highRiskAlertJobDetail())
            .withIdentity("highRiskAlertJobTrigger")
            .withDescription("高风险告警触发器")
            .withSchedule(scheduleBuilder)
            .build();
    }
}

// 高风险告警任务
public class HighRiskAlertJob implements Job {
    private static final Logger logger = LoggerFactory.getLogger(HighRiskAlertJob.class);
    
    @Autowired
    private RiskItemRepository riskItemRepository;
    
    @Autowired
    private NotificationService notificationService;
    
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        try {
            // 查找未处理的高风险项
            List<RiskItem> highRiskItems = riskItemRepository.findRiskItemsByLevel(RiskLevel.HIGH);
            List<RiskItem> criticalRiskItems = riskItemRepository.findRiskItemsByLevel(RiskLevel.CRITICAL);
            
            List<RiskItem> urgentRisks = new ArrayList<>();
            urgentRisks.addAll(highRiskItems);
            urgentRisks.addAll(criticalRiskItems);
            
            if (!urgentRisks.isEmpty()) {
                sendUrgentRiskAlert(urgentRisks);
            }
        } catch (Exception e) {
            logger.error("高风险告警任务执行失败", e);
            throw new JobExecutionException("高风险告警任务执行失败", e);
        }
    }
    
    private void sendUrgentRiskAlert(List<RiskItem> riskItems) {
        StringBuilder message = new StringBuilder();
        message.append("发现 ").append(riskItems.size()).append(" 个高风险项:\n");
        
        for (RiskItem riskItem : riskItems) {
            message.append("- ").append(riskItem.getDescription())
                   .append(" (级别: ").append(riskItem.getRiskLevel())
                   .append(", 时间: ").append(riskItem.getDetectedTime())
                   .append(")\n");
        }
        
        // 发送紧急告警
        notificationService.sendUrgentAlert(message.toString());
    }
}
```

## 企业实践总结

通过以上三个典型的企业应用场景，我们可以看到任务调度平台在实际业务中的重要作用：

1. **电商订单定时关闭**：通过定时任务自动处理超时订单，提高系统自动化水平，减少人工干预
2. **大数据ETL与批量计算**：处理海量数据的提取、转换和加载，支持业务决策和数据分析
3. **金融风控定时校验**：定期检测业务风险，保障金融业务的安全性和合规性

在实际应用中，需要注意以下几点：

### 1. 可靠性保障
- 实现任务失败重试机制
- 使用分布式锁防止重复执行
- 建立完善的监控和告警体系

### 2. 性能优化
- 合理设置任务并发度
- 实现数据分片和批量处理
- 优化数据库查询和索引

### 3. 安全性考虑
- 实现细粒度的权限控制
- 对敏感数据进行加密处理
- 建立完整的审计日志

### 4. 可维护性
- 提供友好的管理界面
- 支持任务的动态配置和调整
- 建立完善的文档和操作手册

通过合理设计和实现，任务调度平台能够为企业的各类业务场景提供稳定、高效的技术支撑，成为企业数字化转型的重要基础设施。

在下一章中，我们将探讨调度平台与微服务体系的结合，包括Spring Cloud/Spring Boot集成调度框架、配置中心与调度的联动、服务发现与任务路由等内容。