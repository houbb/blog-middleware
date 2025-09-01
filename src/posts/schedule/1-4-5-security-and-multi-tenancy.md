---
title: 安全与多租户
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在企业级分布式任务调度系统中，安全性和多租户支持是两个至关重要的方面。随着系统规模的扩大和用户群体的多样化，如何确保任务数据的安全性、实现有效的权限控制以及支持多租户架构成为系统设计的关键挑战。本文将深入探讨任务隔离与权限控制、任务数据加密与审计、多租户架构设计等核心技术，帮助构建安全可靠的调度系统。

## 任务隔离与权限控制

任务隔离和权限控制是确保系统安全的基础。通过合理的隔离机制和细粒度的权限控制，可以防止未授权访问和恶意操作。

### 任务隔离机制

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;

// 任务隔离策略
public enum TaskIsolationStrategy {
    TENANT_BASED,    // 基于租户隔离
    USER_BASED,      // 基于用户隔离
    ROLE_BASED,      // 基于角色隔离
    PROJECT_BASED    // 基于项目隔离
}

// 任务隔离管理器
public class TaskIsolationManager {
    private final Map<String, Set<String>> tenantTasks;
    private final Map<String, Set<String>> userTasks;
    private final Map<String, Set<String>> roleTasks;
    private final ReentrantReadWriteLock lock;
    
    public TaskIsolationManager() {
        this.tenantTasks = new ConcurrentHashMap<>();
        this.userTasks = new ConcurrentHashMap<>();
        this.roleTasks = new ConcurrentHashMap<>();
        this.lock = new ReentrantReadWriteLock();
    }
    
    /**
     * 注册任务到租户
     */
    public void registerTaskToTenant(String taskId, String tenantId) {
        lock.writeLock().lock();
        try {
            tenantTasks.computeIfAbsent(tenantId, k -> new HashSet<>()).add(taskId);
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 注册任务到用户
     */
    public void registerTaskToUser(String taskId, String userId) {
        lock.writeLock().lock();
        try {
            userTasks.computeIfAbsent(userId, k -> new HashSet<>()).add(taskId);
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 注册任务到角色
     */
    public void registerTaskToRole(String taskId, String roleId) {
        lock.writeLock().lock();
        try {
            roleTasks.computeIfAbsent(roleId, k -> new HashSet<>()).add(taskId);
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 检查用户是否有权访问任务
     */
    public boolean canUserAccessTask(String userId, String taskId, Set<String> userRoles, String tenantId) {
        lock.readLock().lock();
        try {
            // 检查直接用户权限
            Set<String> userTaskSet = userTasks.get(userId);
            if (userTaskSet != null && userTaskSet.contains(taskId)) {
                return true;
            }
            
            // 检查角色权限
            for (String roleId : userRoles) {
                Set<String> roleTaskSet = roleTasks.get(roleId);
                if (roleTaskSet != null && roleTaskSet.contains(taskId)) {
                    return true;
                }
            }
            
            // 检查租户权限
            Set<String> tenantTaskSet = tenantTasks.get(tenantId);
            if (tenantTaskSet != null && tenantTaskSet.contains(taskId)) {
                return true;
            }
            
            return false;
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 获取用户可访问的任务列表
     */
    public Set<String> getUserAccessibleTasks(String userId, Set<String> userRoles, String tenantId) {
        lock.readLock().lock();
        try {
            Set<String> accessibleTasks = new HashSet<>();
            
            // 添加用户直接拥有的任务
            Set<String> userTaskSet = userTasks.get(userId);
            if (userTaskSet != null) {
                accessibleTasks.addAll(userTaskSet);
            }
            
            // 添加用户角色拥有的任务
            for (String roleId : userRoles) {
                Set<String> roleTaskSet = roleTasks.get(roleId);
                if (roleTaskSet != null) {
                    accessibleTasks.addAll(roleTaskSet);
                }
            }
            
            // 添加租户拥有的任务
            Set<String> tenantTaskSet = tenantTasks.get(tenantId);
            if (tenantTaskSet != null) {
                accessibleTasks.addAll(tenantTaskSet);
            }
            
            return accessibleTasks;
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 移除任务的所有关联
     */
    public void removeTaskAssociations(String taskId) {
        lock.writeLock().lock();
        try {
            // 从所有用户中移除
            for (Set<String> taskSet : userTasks.values()) {
                taskSet.remove(taskId);
            }
            
            // 从所有角色中移除
            for (Set<String> taskSet : roleTasks.values()) {
                taskSet.remove(taskId);
            }
            
            // 从所有租户中移除
            for (Set<String> taskSet : tenantTasks.values()) {
                taskSet.remove(taskId);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
}

// 安全任务执行器
public class SecureTaskExecutor {
    private final TaskIsolationManager isolationManager;
    private final PermissionChecker permissionChecker;
    private final AuditLogger auditLogger;
    
    public SecureTaskExecutor(TaskIsolationManager isolationManager, 
                             PermissionChecker permissionChecker,
                             AuditLogger auditLogger) {
        this.isolationManager = isolationManager;
        this.permissionChecker = permissionChecker;
        this.auditLogger = auditLogger;
    }
    
    /**
     * 安全执行任务
     */
    public TaskExecutionResult executeTask(String taskId, ExecutionContext context) {
        String userId = context.getUserId();
        String tenantId = context.getTenantId();
        Set<String> userRoles = context.getUserRoles();
        
        // 记录审计日志
        auditLogger.logTaskAccess(userId, taskId, "EXECUTE_ATTEMPT", tenantId);
        
        // 检查权限
        if (!isolationManager.canUserAccessTask(userId, taskId, userRoles, tenantId)) {
            auditLogger.logTaskAccess(userId, taskId, "EXECUTE_DENIED", tenantId);
            throw new SecurityException("用户无权执行任务: " + taskId);
        }
        
        // 检查执行权限
        if (!permissionChecker.hasExecutePermission(userId, taskId, userRoles)) {
            auditLogger.logTaskAccess(userId, taskId, "EXECUTE_PERMISSION_DENIED", tenantId);
            throw new SecurityException("用户无执行权限: " + taskId);
        }
        
        // 执行任务
        try {
            auditLogger.logTaskAccess(userId, taskId, "EXECUTE_STARTED", tenantId);
            TaskExecutionResult result = doExecuteTask(taskId, context);
            auditLogger.logTaskAccess(userId, taskId, "EXECUTE_SUCCESS", tenantId);
            return result;
        } catch (Exception e) {
            auditLogger.logTaskAccess(userId, taskId, "EXECUTE_FAILED", tenantId);
            throw new RuntimeException("任务执行失败", e);
        }
    }
    
    /**
     * 实际执行任务
     */
    private TaskExecutionResult doExecuteTask(String taskId, ExecutionContext context) {
        // 这里应该调用实际的任务执行逻辑
        System.out.println("执行任务: " + taskId + "，用户: " + context.getUserId());
        return TaskExecutionResult.success("任务执行成功");
    }
}

// 权限检查器
public class PermissionChecker {
    private final Map<String, Set<String>> taskPermissions;
    private final ReentrantReadWriteLock lock;
    
    public PermissionChecker() {
        this.taskPermissions = new ConcurrentHashMap<>();
        this.lock = new ReentrantReadWriteLock();
    }
    
    /**
     * 授予权限
     */
    public void grantPermission(String taskId, String permission, String grantee) {
        lock.writeLock().lock();
        try {
            String permissionKey = taskId + ":" + permission;
            taskPermissions.computeIfAbsent(permissionKey, k -> new HashSet<>()).add(grantee);
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 撤销权限
     */
    public void revokePermission(String taskId, String permission, String grantee) {
        lock.writeLock().lock();
        try {
            String permissionKey = taskId + ":" + permission;
            Set<String> grantees = taskPermissions.get(permissionKey);
            if (grantees != null) {
                grantees.remove(grantee);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 检查是否有执行权限
     */
    public boolean hasExecutePermission(String userId, String taskId, Set<String> userRoles) {
        lock.readLock().lock();
        try {
            String permissionKey = taskId + ":EXECUTE";
            Set<String> grantees = taskPermissions.get(permissionKey);
            if (grantees == null) {
                return false;
            }
            
            // 检查直接授权
            if (grantees.contains(userId)) {
                return true;
            }
            
            // 检查角色授权
            for (String roleId : userRoles) {
                if (grantees.contains("ROLE:" + roleId)) {
                    return true;
                }
            }
            
            return false;
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 检查是否有管理权限
     */
    public boolean hasManagePermission(String userId, String taskId, Set<String> userRoles) {
        lock.readLock().lock();
        try {
            String permissionKey = taskId + ":MANAGE";
            Set<String> grantees = taskPermissions.get(permissionKey);
            if (grantees == null) {
                return false;
            }
            
            // 检查直接授权
            if (grantees.contains(userId)) {
                return true;
            }
            
            // 检查角色授权
            for (String roleId : userRoles) {
                if (grantees.contains("ROLE:" + roleId)) {
                    return true;
                }
            }
            
            return false;
        } finally {
            lock.readLock().unlock();
        }
    }
}
```

### 执行上下文

```java
// 执行上下文
public class ExecutionContext {
    private final String userId;
    private final String tenantId;
    private final Set<String> userRoles;
    private final Map<String, Object> contextData;
    
    public ExecutionContext(String userId, String tenantId, Set<String> userRoles) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.userRoles = new HashSet<>(userRoles);
        this.contextData = new HashMap<>();
    }
    
    // getters
    public String getUserId() { return userId; }
    public String getTenantId() { return tenantId; }
    public Set<String> getUserRoles() { return userRoles; }
    public Map<String, Object> getContextData() { return contextData; }
    
    public void addContextData(String key, Object value) {
        contextData.put(key, value);
    }
    
    public <T> T getContextData(String key, Class<T> type) {
        return type.cast(contextData.get(key));
    }
}

// 任务执行结果
public class TaskExecutionResult {
    private final boolean success;
    private final String message;
    private final Object resultData;
    private final long executionTime;
    
    private TaskExecutionResult(boolean success, String message, Object resultData, long executionTime) {
        this.success = success;
        this.message = message;
        this.resultData = resultData;
        this.executionTime = executionTime;
    }
    
    public static TaskExecutionResult success(String message) {
        return new TaskExecutionResult(true, message, null, System.currentTimeMillis());
    }
    
    public static TaskExecutionResult success(String message, Object resultData) {
        return new TaskExecutionResult(true, message, resultData, System.currentTimeMillis());
    }
    
    public static TaskExecutionResult failure(String message) {
        return new TaskExecutionResult(false, message, null, System.currentTimeMillis());
    }
    
    // getters
    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Object getResultData() { return resultData; }
    public long getExecutionTime() { return executionTime; }
}
```

## 任务数据加密与审计

任务数据的加密和审计是保障数据安全和合规性的重要手段。通过数据加密可以防止敏感信息泄露，通过审计可以追踪操作历史和发现安全问题。

### 数据加密管理

```java
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

// 加密管理器
public class EncryptionManager {
    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;
    
    private final SecretKey secretKey;
    
    public EncryptionManager(String base64Key) {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        this.secretKey = new SecretKeySpec(keyBytes, ALGORITHM);
    }
    
    /**
     * 生成新的加密密钥
     */
    public static String generateKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(ALGORITHM);
        keyGenerator.init(256);
        SecretKey key = keyGenerator.generateKey();
        return Base64.getEncoder().encodeToString(key.getEncoded());
    }
    
    /**
     * 加密数据
     */
    public EncryptedData encrypt(String plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        
        // 生成随机IV
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);
        
        GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);
        
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes());
        
        return new EncryptedData(Base64.getEncoder().encodeToString(ciphertext), 
                               Base64.getEncoder().encodeToString(iv));
    }
    
    /**
     * 解密数据
     */
    public String decrypt(EncryptedData encryptedData) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        
        byte[] ciphertext = Base64.getDecoder().decode(encryptedData.getCiphertext());
        byte[] iv = Base64.getDecoder().decode(encryptedData.getIv());
        
        GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
        
        byte[] plaintext = cipher.doFinal(ciphertext);
        return new String(plaintext);
    }
}

// 加密数据封装
public class EncryptedData {
    private final String ciphertext;
    private final String iv;
    
    public EncryptedData(String ciphertext, String iv) {
        this.ciphertext = ciphertext;
        this.iv = iv;
    }
    
    // getters
    public String getCiphertext() { return ciphertext; }
    public String getIv() { return iv; }
}

// 敏感数据处理器
public class SensitiveDataProcessor {
    private final EncryptionManager encryptionManager;
    private final Set<String> sensitiveFields;
    
    public SensitiveDataProcessor(EncryptionManager encryptionManager) {
        this.encryptionManager = encryptionManager;
        this.sensitiveFields = new HashSet<>(Arrays.asList(
            "password", "secret", "token", "apiKey", "privateKey"
        ));
    }
    
    /**
     * 加密敏感数据
     */
    public Map<String, Object> encryptSensitiveData(Map<String, Object> data) {
        Map<String, Object> encryptedData = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            if (sensitiveFields.contains(key.toLowerCase()) && value instanceof String) {
                try {
                    EncryptedData encrypted = encryptionManager.encrypt((String) value);
                    encryptedData.put(key, encrypted);
                } catch (Exception e) {
                    throw new RuntimeException("加密失败: " + key, e);
                }
            } else {
                encryptedData.put(key, value);
            }
        }
        
        return encryptedData;
    }
    
    /**
     * 解密敏感数据
     */
    public Map<String, Object> decryptSensitiveData(Map<String, Object> data) {
        Map<String, Object> decryptedData = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            if (value instanceof EncryptedData) {
                try {
                    String decrypted = encryptionManager.decrypt((EncryptedData) value);
                    decryptedData.put(key, decrypted);
                } catch (Exception e) {
                    throw new RuntimeException("解密失败: " + key, e);
                }
            } else {
                decryptedData.put(key, value);
            }
        }
        
        return decryptedData;
    }
}
```

### 审计日志管理

```java
import java.time.LocalDateTime;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

// 审计日志条目
public class AuditLogEntry {
    private final String userId;
    private final String tenantId;
    private final String taskId;
    private final String action;
    private final String details;
    private final LocalDateTime timestamp;
    private final String ipAddress;
    private final String userAgent;
    
    public AuditLogEntry(String userId, String tenantId, String taskId, 
                        String action, String details, String ipAddress, String userAgent) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.taskId = taskId;
        this.action = action;
        this.details = details;
        this.timestamp = LocalDateTime.now();
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
    }
    
    // getters
    public String getUserId() { return userId; }
    public String getTenantId() { return tenantId; }
    public String getTaskId() { return taskId; }
    public String getAction() { return action; }
    public String getDetails() { return details; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    
    @Override
    public String toString() {
        return String.format("AuditLogEntry{userId='%s', tenantId='%s', taskId='%s', " +
                           "action='%s', timestamp=%s, ipAddress='%s'}",
                           userId, tenantId, taskId, action, timestamp, ipAddress);
    }
}

// 审计日志记录器
public class AuditLogger {
    private final BlockingQueue<AuditLogEntry> logQueue;
    private final AuditLogWriter logWriter;
    private final Thread logProcessorThread;
    private volatile boolean running = true;
    
    public AuditLogger(AuditLogWriter logWriter) {
        this.logQueue = new LinkedBlockingQueue<>(10000);
        this.logWriter = logWriter;
        this.logProcessorThread = new Thread(this::processLogs);
        this.logProcessorThread.setDaemon(true);
        this.logProcessorThread.start();
    }
    
    /**
     * 记录任务访问日志
     */
    public void logTaskAccess(String userId, String taskId, String action, String tenantId) {
        logTaskAccess(userId, taskId, action, tenantId, "", "", "");
    }
    
    /**
     * 记录任务访问日志（详细信息）
     */
    public void logTaskAccess(String userId, String taskId, String action, String tenantId,
                             String details, String ipAddress, String userAgent) {
        AuditLogEntry entry = new AuditLogEntry(userId, tenantId, taskId, action, 
                                              details, ipAddress, userAgent);
        if (!logQueue.offer(entry)) {
            System.err.println("审计日志队列已满，丢弃日志条目: " + entry);
        }
    }
    
    /**
     * 处理日志队列
     */
    private void processLogs() {
        while (running) {
            try {
                AuditLogEntry entry = logQueue.take();
                logWriter.writeLog(entry);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                System.err.println("处理审计日志时发生错误: " + e.getMessage());
            }
        }
    }
    
    /**
     * 关闭日志记录器
     */
    public void shutdown() {
        running = false;
        logProcessorThread.interrupt();
    }
}

// 审计日志写入器接口
public interface AuditLogWriter {
    void writeLog(AuditLogEntry entry);
}

// 数据库审计日志写入器
public class DatabaseAuditLogWriter implements AuditLogWriter {
    private final DataSource dataSource;
    
    public DatabaseAuditLogWriter(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    @Override
    public void writeLog(AuditLogEntry entry) {
        String sql = "INSERT INTO audit_logs (user_id, tenant_id, task_id, action, " +
                    "details, timestamp, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, entry.getUserId());
            stmt.setString(2, entry.getTenantId());
            stmt.setString(3, entry.getTaskId());
            stmt.setString(4, entry.getAction());
            stmt.setString(5, entry.getDetails());
            stmt.setTimestamp(6, Timestamp.valueOf(entry.getTimestamp()));
            stmt.setString(7, entry.getIpAddress());
            stmt.setString(8, entry.getUserAgent());
            
            stmt.executeUpdate();
        } catch (SQLException e) {
            System.err.println("写入审计日志失败: " + e.getMessage());
        }
    }
}

// 文件审计日志写入器
public class FileAuditLogWriter implements AuditLogWriter {
    private final String logFilePath;
    private final ObjectMapper objectMapper;
    
    public FileAuditLogWriter(String logFilePath) {
        this.logFilePath = logFilePath;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }
    
    @Override
    public void writeLog(AuditLogEntry entry) {
        try {
            String json = objectMapper.writeValueAsString(entry);
            Files.write(Paths.get(logFilePath), 
                       (json + System.lineSeparator()).getBytes(),
                       StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception e) {
            System.err.println("写入审计日志文件失败: " + e.getMessage());
        }
    }
}
```

## 多租户架构设计

多租户架构允许一个系统实例为多个租户提供服务，每个租户的数据和配置相互隔离。在任务调度系统中，多租户设计可以提高资源利用率和降低运维成本。

### 多租户管理

```java
// 租户信息
public class Tenant {
    private final String id;
    private final String name;
    private final String description;
    private final TenantConfiguration configuration;
    private final Set<String> administrators;
    private final LocalDateTime createdAt;
    private final boolean active;
    
    public Tenant(String id, String name, String description, 
                 TenantConfiguration configuration, Set<String> administrators) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.configuration = configuration;
        this.administrators = new HashSet<>(administrators);
        this.createdAt = LocalDateTime.now();
        this.active = true;
    }
    
    // getters
    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public TenantConfiguration getConfiguration() { return configuration; }
    public Set<String> getAdministrators() { return administrators; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isActive() { return active; }
}

// 租户配置
public class TenantConfiguration {
    private int maxConcurrentTasks = 100;
    private long maxTaskExecutionTimeMs = 3600000; // 1小时
    private int maxTaskRetries = 3;
    private Set<String> allowedTaskTypes = new HashSet<>();
    private Map<String, String> customProperties = new HashMap<>();
    
    public TenantConfiguration() {
        // 默认允许所有任务类型
        this.allowedTaskTypes.addAll(Arrays.asList(
            "SHELL", "JAVA", "PYTHON", "HTTP", "DATABASE"
        ));
    }
    
    // getters and setters
    public int getMaxConcurrentTasks() { return maxConcurrentTasks; }
    public void setMaxConcurrentTasks(int maxConcurrentTasks) { this.maxConcurrentTasks = maxConcurrentTasks; }
    public long getMaxTaskExecutionTimeMs() { return maxTaskExecutionTimeMs; }
    public void setMaxTaskExecutionTimeMs(long maxTaskExecutionTimeMs) { this.maxTaskExecutionTimeMs = maxTaskExecutionTimeMs; }
    public int getMaxTaskRetries() { return maxTaskRetries; }
    public void setMaxTaskRetries(int maxTaskRetries) { this.maxTaskRetries = maxTaskRetries; }
    public Set<String> getAllowedTaskTypes() { return allowedTaskTypes; }
    public void setAllowedTaskTypes(Set<String> allowedTaskTypes) { this.allowedTaskTypes = allowedTaskTypes; }
    public Map<String, String> getCustomProperties() { return customProperties; }
    public void setCustomProperties(Map<String, String> customProperties) { this.customProperties = customProperties; }
}

// 多租户管理器
public class MultiTenantManager {
    private final Map<String, Tenant> tenants;
    private final Map<String, Set<String>> tenantUsers;
    private final ReentrantReadWriteLock lock;
    
    public MultiTenantManager() {
        this.tenants = new ConcurrentHashMap<>();
        this.tenantUsers = new ConcurrentHashMap<>();
        this.lock = new ReentrantReadWriteLock();
    }
    
    /**
     * 创建租户
     */
    public void createTenant(Tenant tenant) {
        lock.writeLock().lock();
        try {
            if (tenants.containsKey(tenant.getId())) {
                throw new IllegalArgumentException("租户已存在: " + tenant.getId());
            }
            tenants.put(tenant.getId(), tenant);
            tenantUsers.put(tenant.getId(), new HashSet<>());
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 获取租户
     */
    public Tenant getTenant(String tenantId) {
        lock.readLock().lock();
        try {
            return tenants.get(tenantId);
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 添加用户到租户
     */
    public void addUserToTenant(String userId, String tenantId) {
        lock.writeLock().lock();
        try {
            Set<String> users = tenantUsers.get(tenantId);
            if (users != null) {
                users.add(userId);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 从租户移除用户
     */
    public void removeUserFromTenant(String userId, String tenantId) {
        lock.writeLock().lock();
        try {
            Set<String> users = tenantUsers.get(tenantId);
            if (users != null) {
                users.remove(userId);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 检查用户是否属于租户
     */
    public boolean isUserInTenant(String userId, String tenantId) {
        lock.readLock().lock();
        try {
            Set<String> users = tenantUsers.get(tenantId);
            return users != null && users.contains(userId);
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 获取租户的所有用户
     */
    public Set<String> getTenantUsers(String tenantId) {
        lock.readLock().lock();
        try {
            Set<String> users = tenantUsers.get(tenantId);
            return users != null ? new HashSet<>(users) : new HashSet<>();
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 获取用户所属的所有租户
     */
    public Set<String> getUserTenants(String userId) {
        lock.readLock().lock();
        try {
            Set<String> userTenants = new HashSet<>();
            for (Map.Entry<String, Set<String>> entry : tenantUsers.entrySet()) {
                if (entry.getValue().contains(userId)) {
                    userTenants.add(entry.getKey());
                }
            }
            return userTenants;
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 验证租户配置
     */
    public boolean validateTenantConfiguration(String tenantId, String taskType) {
        lock.readLock().lock();
        try {
            Tenant tenant = tenants.get(tenantId);
            if (tenant == null) {
                return false;
            }
            
            TenantConfiguration config = tenant.getConfiguration();
            return config.getAllowedTaskTypes().contains(taskType);
        } finally {
            lock.readLock().unlock();
        }
    }
}

// 租户上下文过滤器
public class TenantContextFilter implements Filter {
    private final MultiTenantManager tenantManager;
    
    public TenantContextFilter(MultiTenantManager tenantManager) {
        this.tenantManager = tenantManager;
    }
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String tenantId = httpRequest.getHeader("X-Tenant-ID");
        String userId = httpRequest.getHeader("X-User-ID");
        
        // 验证租户和用户关系
        if (tenantId != null && userId != null) {
            if (!tenantManager.isUserInTenant(userId, tenantId)) {
                ((HttpServletResponse) response).sendError(
                    HttpServletResponse.SC_FORBIDDEN, "用户不属于指定租户");
                return;
            }
            
            // 设置租户上下文
            TenantContext.setTenantId(tenantId);
            TenantContext.setUserId(userId);
        }
        
        try {
            chain.doFilter(request, response);
        } finally {
            // 清理租户上下文
            TenantContext.clear();
        }
    }
}

// 租户上下文持有者
public class TenantContext {
    private static final ThreadLocal<String> tenantIdHolder = new ThreadLocal<>();
    private static final ThreadLocal<String> userIdHolder = new ThreadLocal<>();
    
    public static void setTenantId(String tenantId) {
        tenantIdHolder.set(tenantId);
    }
    
    public static String getTenantId() {
        return tenantIdHolder.get();
    }
    
    public static void setUserId(String userId) {
        userIdHolder.set(userId);
    }
    
    public static String getUserId() {
        return userIdHolder.get();
    }
    
    public static void clear() {
        tenantIdHolder.remove();
        userIdHolder.remove();
    }
}
```

### 多租户资源配额管理

```java
// 资源配额
public class ResourceQuota {
    private final String tenantId;
    private final int maxConcurrentTasks;
    private final long maxStorageBytes;
    private final int maxUsers;
    private final Map<String, Integer> taskTypeLimits;
    
    public ResourceQuota(String tenantId, int maxConcurrentTasks, 
                        long maxStorageBytes, int maxUsers) {
        this.tenantId = tenantId;
        this.maxConcurrentTasks = maxConcurrentTasks;
        this.maxStorageBytes = maxStorageBytes;
        this.maxUsers = maxUsers;
        this.taskTypeLimits = new HashMap<>();
    }
    
    // getters
    public String getTenantId() { return tenantId; }
    public int getMaxConcurrentTasks() { return maxConcurrentTasks; }
    public long getMaxStorageBytes() { return maxStorageBytes; }
    public int getMaxUsers() { return maxUsers; }
    public Map<String, Integer> getTaskTypeLimits() { return taskTypeLimits; }
    
    public void setTaskTypeLimit(String taskType, int limit) {
        taskTypeLimits.put(taskType, limit);
    }
}

// 配额管理器
public class QuotaManager {
    private final Map<String, ResourceQuota> quotas;
    private final Map<String, AtomicInteger> currentUsage;
    private final ReentrantReadWriteLock lock;
    
    public QuotaManager() {
        this.quotas = new ConcurrentHashMap<>();
        this.currentUsage = new ConcurrentHashMap<>();
        this.lock = new ReentrantReadWriteLock();
    }
    
    /**
     * 设置租户配额
     */
    public void setQuota(ResourceQuota quota) {
        lock.writeLock().lock();
        try {
            quotas.put(quota.getTenantId(), quota);
            currentUsage.putIfAbsent(quota.getTenantId(), new AtomicInteger(0));
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 检查是否超出配额
     */
    public boolean checkQuota(String tenantId, String resourceType, int amount) {
        lock.readLock().lock();
        try {
            ResourceQuota quota = quotas.get(tenantId);
            if (quota == null) {
                return true; // 没有配额限制
            }
            
            AtomicInteger usage = currentUsage.get(tenantId);
            if (usage == null) {
                return true;
            }
            
            switch (resourceType) {
                case "CONCURRENT_TASKS":
                    return usage.get() + amount <= quota.getMaxConcurrentTasks();
                case "STORAGE":
                    // 这里应该检查存储使用量
                    return true;
                default:
                    return true;
            }
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 增加资源使用量
     */
    public boolean incrementUsage(String tenantId, String resourceType, int amount) {
        lock.writeLock().lock();
        try {
            if (!checkQuota(tenantId, resourceType, amount)) {
                return false;
            }
            
            AtomicInteger usage = currentUsage.get(tenantId);
            if (usage != null) {
                usage.addAndGet(amount);
            }
            return true;
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 减少资源使用量
     */
    public void decrementUsage(String tenantId, String resourceType, int amount) {
        lock.writeLock().lock();
        try {
            AtomicInteger usage = currentUsage.get(tenantId);
            if (usage != null) {
                usage.addAndGet(-amount);
                if (usage.get() < 0) {
                    usage.set(0);
                }
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
    
    /**
     * 获取当前使用量
     */
    public int getCurrentUsage(String tenantId, String resourceType) {
        lock.readLock().lock();
        try {
            AtomicInteger usage = currentUsage.get(tenantId);
            return usage != null ? usage.get() : 0;
        } finally {
            lock.readLock().unlock();
        }
    }
    
    /**
     * 获取配额信息
     */
    public ResourceQuota getQuota(String tenantId) {
        lock.readLock().lock();
        try {
            return quotas.get(tenantId);
        } finally {
            lock.readLock().unlock();
        }
    }
}
```

## 综合安全示例

```java
public class SecurityExample {
    public static void main(String[] args) throws Exception {
        // 初始化安全组件
        String encryptionKey = EncryptionManager.generateKey();
        EncryptionManager encryptionManager = new EncryptionManager(encryptionKey);
        SensitiveDataProcessor dataProcessor = new SensitiveDataProcessor(encryptionManager);
        
        DatabaseAuditLogWriter dbLogWriter = new DatabaseAuditLogWriter(createDataSource());
        AuditLogger auditLogger = new AuditLogger(dbLogWriter);
        
        TaskIsolationManager isolationManager = new TaskIsolationManager();
        PermissionChecker permissionChecker = new PermissionChecker();
        SecureTaskExecutor secureExecutor = new SecureTaskExecutor(
            isolationManager, permissionChecker, auditLogger);
        
        MultiTenantManager tenantManager = new MultiTenantManager();
        QuotaManager quotaManager = new QuotaManager();
        
        // 创建租户
        TenantConfiguration config = new TenantConfiguration();
        config.setMaxConcurrentTasks(50);
        Tenant tenant = new Tenant("tenant-001", "示例公司", "示例租户", 
                                 config, Set.of("admin-user"));
        tenantManager.createTenant(tenant);
        
        // 设置配额
        ResourceQuota quota = new ResourceQuota("tenant-001", 50, 1073741824L, 100); // 1GB存储
        quotaManager.setQuota(quota);
        
        // 注册用户到租户
        tenantManager.addUserToTenant("user-001", "tenant-001");
        tenantManager.addUserToTenant("admin-user", "tenant-001");
        
        // 示例1: 任务隔离和权限控制
        System.out.println("=== 示例1: 任务隔离和权限控制 ===");
        String taskId = "task-001";
        String userId = "user-001";
        String tenantId = "tenant-001";
        
        // 注册任务到租户和用户
        isolationManager.registerTaskToTenant(taskId, tenantId);
        isolationManager.registerTaskToUser(taskId, userId);
        permissionChecker.grantPermission(taskId, "EXECUTE", userId);
        
        // 检查用户权限
        Set<String> userRoles = new HashSet<>();
        boolean canAccess = isolationManager.canUserAccessTask(userId, taskId, userRoles, tenantId);
        System.out.println("用户 " + userId + " 可以访问任务 " + taskId + ": " + canAccess);
        
        // 安全执行任务
        ExecutionContext context = new ExecutionContext(userId, tenantId, userRoles);
        try {
            TaskExecutionResult result = secureExecutor.executeTask(taskId, context);
            System.out.println("任务执行结果: " + result.getMessage());
        } catch (SecurityException e) {
            System.out.println("任务执行被拒绝: " + e.getMessage());
        }
        
        // 示例2: 数据加密
        System.out.println("\n=== 示例2: 数据加密 ===");
        Map<String, Object> sensitiveData = new HashMap<>();
        sensitiveData.put("username", "testuser");
        sensitiveData.put("password", "secret123");
        sensitiveData.put("apiKey", "sk-1234567890");
        sensitiveData.put("normalData", "normal value");
        
        // 加密敏感数据
        Map<String, Object> encryptedData = dataProcessor.encryptSensitiveData(sensitiveData);
        System.out.println("加密后的数据: " + encryptedData);
        
        // 解密敏感数据
        Map<String, Object> decryptedData = dataProcessor.decryptSensitiveData(encryptedData);
        System.out.println("解密后的数据: " + decryptedData);
        
        // 示例3: 审计日志
        System.out.println("\n=== 示例3: 审计日志 ===");
        auditLogger.logTaskAccess("user-001", "task-001", "EXECUTE_ATTEMPT", "tenant-001",
                                "用户尝试执行任务", "192.168.1.100", "Mozilla/5.0");
        
        // 示例4: 多租户配额检查
        System.out.println("\n=== 示例4: 多租户配额检查 ===");
        boolean withinQuota = quotaManager.checkQuota("tenant-001", "CONCURRENT_TASKS", 10);
        System.out.println("租户 tenant-001 是否在配额内: " + withinQuota);
        
        if (withinQuota) {
            quotaManager.incrementUsage("tenant-001", "CONCURRENT_TASKS", 10);
            int currentUsage = quotaManager.getCurrentUsage("tenant-001", "CONCURRENT_TASKS");
            System.out.println("当前并发任务使用量: " + currentUsage);
        }
        
        // 等待日志处理完成
        Thread.sleep(2000);
        
        // 关闭资源
        auditLogger.shutdown();
    }
    
    private static DataSource createDataSource() {
        // 创建模拟的数据源
        return new HikariDataSource(); // 实际应用中需要配置连接参数
    }
}
```

## 最佳实践

### 1. 安全配置管理

```java
// 安全配置
public class SecurityConfiguration {
    private boolean encryptionEnabled = true;
    private String encryptionKey;
    private boolean auditEnabled = true;
    private List<String> sensitiveDataFields = Arrays.asList(
        "password", "secret", "token", "apiKey", "privateKey", "credential"
    );
    private int maxFailedAttempts = 5;
    private long lockoutDurationMs = 300000; // 5分钟
    
    // getters and setters
    public boolean isEncryptionEnabled() { return encryptionEnabled; }
    public void setEncryptionEnabled(boolean encryptionEnabled) { this.encryptionEnabled = encryptionEnabled; }
    public String getEncryptionKey() { return encryptionKey; }
    public void setEncryptionKey(String encryptionKey) { this.encryptionKey = encryptionKey; }
    public boolean isAuditEnabled() { return auditEnabled; }
    public void setAuditEnabled(boolean auditEnabled) { this.auditEnabled = auditEnabled; }
    public List<String> getSensitiveDataFields() { return sensitiveDataFields; }
    public void setSensitiveDataFields(List<String> sensitiveDataFields) { this.sensitiveDataFields = sensitiveDataFields; }
    public int getMaxFailedAttempts() { return maxFailedAttempts; }
    public void setMaxFailedAttempts(int maxFailedAttempts) { this.maxFailedAttempts = maxFailedAttempts; }
    public long getLockoutDurationMs() { return lockoutDurationMs; }
    public void setLockoutDurationMs(long lockoutDurationMs) { this.lockoutDurationMs = lockoutDurationMs; }
}
```

### 2. 安全监控和告警

```java
// 安全事件监控器
public class SecurityEventMonitor {
    private final MeterRegistry meterRegistry;
    private final List<SecurityEventListener> listeners;
    
    public SecurityEventMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.listeners = new ArrayList<>();
    }
    
    public void addListener(SecurityEventListener listener) {
        listeners.add(listener);
    }
    
    public void recordSecurityEvent(String eventType, String userId, String tenantId, String details) {
        // 记录指标
        Counter.builder("security.events")
            .tag("type", eventType)
            .tag("tenant", tenantId)
            .register(meterRegistry)
            .increment();
        
        // 通知监听器
        SecurityEvent event = new SecurityEvent(eventType, userId, tenantId, details, System.currentTimeMillis());
        for (SecurityEventListener listener : listeners) {
            try {
                listener.onSecurityEvent(event);
            } catch (Exception e) {
                System.err.println("安全事件监听器处理失败: " + e.getMessage());
            }
        }
    }
    
    public void recordFailedAccess(String userId, String tenantId, String resourceId) {
        recordSecurityEvent("FAILED_ACCESS", userId, tenantId, "资源: " + resourceId);
    }
    
    public void recordUnauthorizedAccess(String userId, String tenantId, String resourceId) {
        recordSecurityEvent("UNAUTHORIZED_ACCESS", userId, tenantId, "资源: " + resourceId);
    }
}

// 安全事件
public class SecurityEvent {
    private final String eventType;
    private final String userId;
    private final String tenantId;
    private final String details;
    private final long timestamp;
    
    public SecurityEvent(String eventType, String userId, String tenantId, String details, long timestamp) {
        this.eventType = eventType;
        this.userId = userId;
        this.tenantId = tenantId;
        this.details = details;
        this.timestamp = timestamp;
    }
    
    // getters
    public String getEventType() { return eventType; }
    public String getUserId() { return userId; }
    public String getTenantId() { return tenantId; }
    public String getDetails() { return details; }
    public long getTimestamp() { return timestamp; }
}

// 安全事件监听器
public interface SecurityEventListener {
    void onSecurityEvent(SecurityEvent event);
}

// 告警安全事件监听器
public class AlertingSecurityEventListener implements SecurityEventListener {
    private final int alertThreshold = 10; // 10次事件触发告警
    private final Map<String, AtomicInteger> eventCounters = new ConcurrentHashMap<>();
    
    @Override
    public void onSecurityEvent(SecurityEvent event) {
        String key = event.getTenantId() + ":" + event.getEventType();
        AtomicInteger counter = eventCounters.computeIfAbsent(key, k -> new AtomicInteger(0));
        int count = counter.incrementAndGet();
        
        if (count >= alertThreshold) {
            sendAlert(event);
            counter.set(0); // 重置计数器
        }
    }
    
    private void sendAlert(SecurityEvent event) {
        System.out.println("安全告警: 租户 " + event.getTenantId() + 
                          " 发生 " + event.getEventType() + " 事件，详情: " + event.getDetails());
        // 实际应用中应该发送邮件、短信或其他告警通知
    }
}
```

## 总结

安全与多租户设计是企业级分布式任务调度系统不可或缺的重要组成部分。通过合理的任务隔离与权限控制、数据加密与审计、多租户架构设计，我们可以构建出安全可靠的调度系统。

关键要点包括：

1. **任务隔离机制**：通过租户、用户、角色等维度实现任务隔离，防止未授权访问
2. **权限控制系统**：实现细粒度的权限控制，确保用户只能访问授权的资源
3. **数据加密保护**：对敏感数据进行加密存储和传输，防止数据泄露
4. **审计日志追踪**：完整记录系统操作日志，便于安全审计和问题排查
5. **多租户架构**：支持多租户模式，提高资源利用率和降低运维成本
6. **配额管理**：通过资源配额控制，防止租户过度使用系统资源

在实际应用中，需要根据具体的业务需求和安全要求，选择合适的安全机制，并建立完善的安全监控和告警体系，确保系统能够持续安全稳定地运行。

在下一章中，我们将探讨调度平台的企业实践，包括电商订单定时关闭、大数据ETL与批量计算、金融风控定时校验等实际应用场景。