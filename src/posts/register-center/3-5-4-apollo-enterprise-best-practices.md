---
title: Apollo企业级最佳实践
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center, apollo]
published: true
---

Apollo作为企业级配置管理中心，在实际应用中需要遵循一系列最佳实践，以确保系统的稳定性、安全性和可维护性。本章将深入探讨Apollo在企业环境中的部署策略、权限管理、监控告警、性能优化等方面的最佳实践，帮助读者构建高可用的配置管理体系。

## Apollo部署架构最佳实践

在企业环境中部署Apollo时，需要根据业务规模和可用性要求设计合理的架构方案。

### 高可用部署架构

```yaml
# Apollo高可用部署架构
# 生产环境推荐的三数据中心部署方案

# 数据中心1 (主数据中心)
datacenter-1:
  # Config Service (至少2个实例)
  config-service:
    instances:
      - host: config-1.dc1.company.com
        port: 8080
      - host: config-2.dc1.company.com
        port: 8080
    load-balancer: lb-config.dc1.company.com
  
  # Admin Service (至少2个实例)
  admin-service:
    instances:
      - host: admin-1.dc1.company.com
        port: 8090
      - host: admin-2.dc1.company.com
        port: 8090
    load-balancer: lb-admin.dc1.company.com
  
  # Portal (至少2个实例)
  portal:
    instances:
      - host: portal-1.dc1.company.com
        port: 8070
      - host: portal-2.dc1.company.com
        port: 8070
    load-balancer: lb-portal.dc1.company.com

# 数据中心2 (灾备数据中心)
datacenter-2:
  config-service:
    instances:
      - host: config-1.dc2.company.com
        port: 8080
  admin-service:
    instances:
      - host: admin-1.dc2.company.com
        port: 8090
  portal:
    instances:
      - host: portal-1.dc2.company.com
        port: 8070

# 数据中心3 (灾备数据中心)
datacenter-3:
  config-service:
    instances:
      - host: config-1.dc3.company.com
        port: 8080
  admin-service:
    instances:
      - host: admin-1.dc3.company.com
        port: 8090
```

### 数据库部署策略

```sql
-- Apollo数据库高可用部署
-- 主库 (读写)
CREATE DATABASE ApolloConfigDB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
-- 从库1 (只读)
CREATE DATABASE ApolloConfigDB_Slave1 CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
-- 从库2 (只读)
CREATE DATABASE ApolloConfigDB_Slave2 CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- 数据库表结构优化
-- Config表分区策略
ALTER TABLE Config 
PARTITION BY RANGE (YEAR(CreateTime)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 索引优化
CREATE INDEX idx_app_cluster_ns ON Config (AppId, Cluster, Namespace);
CREATE INDEX idx_release_time ON Release (ReleaseTime);
```

### 网络与安全配置

```java
// Apollo安全配置最佳实践
@Configuration
public class ApolloSecurityConfiguration {
    
    // SSL配置
    @Bean
    public SslContextFactory sslContextFactory() {
        SslContextFactory factory = new SslContextFactory();
        factory.setKeyStorePath("/path/to/keystore.jks");
        factory.setKeyStorePassword("keystore_password");
        factory.setTrustStorePath("/path/to/truststore.jks");
        factory.setTrustStorePassword("truststore_password");
        return factory;
    }
    
    // 访问控制配置
    @Bean
    public AccessControlFilter accessControlFilter() {
        AccessControlFilter filter = new AccessControlFilter();
        filter.setAllowedIps(Arrays.asList(
            "192.168.1.0/24",    // 内网IP段
            "10.0.0.0/8"         // 内网IP段
        ));
        return filter;
    }
    
    // 请求限流配置
    @Bean
    public RateLimitFilter rateLimitFilter() {
        RateLimitFilter filter = new RateLimitFilter();
        filter.setRequestsPerSecond(1000);  // 每秒1000个请求
        filter.setBurstCapacity(2000);      // 突发容量2000
        return filter;
    }
}
```

## 权限管理最佳实践

完善的权限管理体系是企业级Apollo部署的核心要求。

### 基于RBAC的权限模型

```java
// Apollo权限管理实现
@Service
public class ApolloPermissionService {
    
    // 角色定义
    public enum Role {
        SUPER_ADMIN,     // 超级管理员 - 拥有所有权限
        APP_ADMIN,       // 应用管理员 - 管理指定应用
        CONFIG_EDITOR,   // 配置编辑者 - 编辑配置
        CONFIG_VIEWER    // 配置查看者 - 仅查看配置
    }
    
    // 权限定义
    public enum Permission {
        // 应用管理权限
        APP_CREATE,
        APP_DELETE,
        APP_MODIFY,
        
        // 配置管理权限
        CONFIG_PUBLISH,
        CONFIG_EDIT,
        CONFIG_VIEW,
        CONFIG_DELETE,
        
        // 环境管理权限
        ENV_CREATE,
        ENV_DELETE,
        ENV_MODIFY,
        
        // 用户管理权限
        USER_MANAGE,
        ROLE_MANAGE
    }
    
    // 用户角色映射
    public static class UserRole {
        private String userId;
        private String appId;  // 应用级别权限时使用
        private Role role;
        private Date createTime;
        
        // getters and setters
    }
    
    // 权限检查
    public boolean hasPermission(String userId, String appId, Permission permission) {
        // 1. 获取用户角色
        List<UserRole> userRoles = getUserRoles(userId);
        
        // 2. 检查超级管理员权限
        if (userRoles.stream().anyMatch(role -> role.getRole() == Role.SUPER_ADMIN)) {
            return true;
        }
        
        // 3. 检查应用级别权限
        UserRole appRole = userRoles.stream()
            .filter(role -> appId.equals(role.getAppId()))
            .findFirst()
            .orElse(null);
            
        if (appRole != null) {
            return checkRolePermission(appRole.getRole(), permission);
        }
        
        return false;
    }
    
    private boolean checkRolePermission(Role role, Permission permission) {
        switch (role) {
            case SUPER_ADMIN:
                return true;
            case APP_ADMIN:
                return isAppAdminPermission(permission);
            case CONFIG_EDITOR:
                return isConfigEditorPermission(permission);
            case CONFIG_VIEWER:
                return permission == Permission.CONFIG_VIEW;
            default:
                return false;
        }
    }
    
    private boolean isAppAdminPermission(Permission permission) {
        return permission == Permission.APP_CREATE || 
               permission == Permission.APP_DELETE || 
               permission == Permission.APP_MODIFY ||
               isConfigEditorPermission(permission);
    }
    
    private boolean isConfigEditorPermission(Permission permission) {
        return permission == Permission.CONFIG_PUBLISH ||
               permission == Permission.CONFIG_EDIT ||
               permission == Permission.CONFIG_VIEW ||
               permission == Permission.CONFIG_DELETE;
    }
}
```

### 细粒度权限控制

```java
// 细粒度权限控制实现
@Component
public class FineGrainedPermissionControl {
    
    // 命名空间级别权限
    public static class NamespacePermission {
        private String appId;
        private String namespace;
        private String userId;
        private Set<Permission> permissions;
        private Date createTime;
        
        // getters and setters
    }
    
    // 环境级别权限
    public static class EnvironmentPermission {
        private String appId;
        private String cluster;
        private String userId;
        private Set<Permission> permissions;
        private Date createTime;
        
        // getters and setters
    }
    
    // 权限继承关系
    public boolean checkPermissionWithInheritance(String userId, String appId, 
                                                String cluster, String namespace, 
                                                Permission permission) {
        // 1. 检查命名空间级别权限
        if (hasNamespacePermission(userId, appId, namespace, permission)) {
            return true;
        }
        
        // 2. 检查环境级别权限
        if (hasEnvironmentPermission(userId, appId, cluster, permission)) {
            return true;
        }
        
        // 3. 检查应用级别权限
        if (hasAppPermission(userId, appId, permission)) {
            return true;
        }
        
        return false;
    }
    
    // 权限审批流程
    @Service
    public class PermissionApprovalWorkflow {
        
        public enum ApprovalStatus {
            PENDING,    // 待审批
            APPROVED,   // 已批准
            REJECTED    // 已拒绝
        }
        
        public static class PermissionRequest {
            private String requestId;
            private String applicantId;
            private String targetAppId;
            private String targetNamespace;
            private Permission permission;
            private String reason;
            private List<String> approvers;
            private ApprovalStatus status;
            private Date createTime;
            private Date updateTime;
            
            // getters and setters
        }
        
        // 提交权限申请
        public PermissionRequest submitPermissionRequest(PermissionRequest request) {
            // 验证申请信息
            validatePermissionRequest(request);
            
            // 保存申请记录
            request.setStatus(ApprovalStatus.PENDING);
            request.setCreateTime(new Date());
            request.setUpdateTime(new Date());
            
            PermissionRequest savedRequest = permissionRequestRepository.save(request);
            
            // 通知审批人
            notificationService.notifyApprovers(savedRequest);
            
            return savedRequest;
        }
        
        // 审批权限申请
        public void approvePermissionRequest(String requestId, String approverId, boolean approved, String comment) {
            PermissionRequest request = permissionRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("申请不存在"));
            
            if (!request.getApprovers().contains(approverId)) {
                throw new RuntimeException("无审批权限");
            }
            
            request.setStatus(approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED);
            request.setUpdateTime(new Date());
            
            permissionRequestRepository.save(request);
            
            // 如果批准，创建权限记录
            if (approved) {
                createPermissionRecord(request);
            }
            
            // 通知申请人
            notificationService.notifyApplicant(request, approved, comment);
        }
    }
}
```

## 监控告警最佳实践

完善的监控告警体系是保障Apollo稳定运行的关键。

### 核心监控指标

```java
// Apollo监控指标定义
@Component
public class ApolloMetricsCollector {
    
    // 使用Micrometer收集指标
    private final MeterRegistry meterRegistry;
    
    // 核心指标
    private final Counter configPublishCounter;
    private final Timer configPublishTimer;
    private final Counter configQueryCounter;
    private final Timer configQueryTimer;
    private final Gauge activeClientGauge;
    private final Counter errorCounter;
    
    public ApolloMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        // 配置发布计数器
        this.configPublishCounter = Counter.builder("apollo.config.publish.total")
            .description("配置发布总次数")
            .register(meterRegistry);
            
        // 配置发布耗时计时器
        this.configPublishTimer = Timer.builder("apollo.config.publish.latency")
            .description("配置发布耗时")
            .register(meterRegistry);
            
        // 配置查询计数器
        this.configQueryCounter = Counter.builder("apollo.config.query.total")
            .description("配置查询总次数")
            .register(meterRegistry);
            
        // 配置查询耗时计时器
        this.configQueryTimer = Timer.builder("apollo.config.query.latency")
            .description("配置查询耗时")
            .register(meterRegistry);
            
        // 活跃客户端数量
        this.activeClientGauge = Gauge.builder("apollo.client.active")
            .description("活跃客户端数量")
            .register(meterRegistry, this, ApolloMetricsCollector::getActiveClientCount);
            
        // 错误计数器
        this.errorCounter = Counter.builder("apollo.error.total")
            .description("Apollo错误总次数")
            .tag("type", "all")
            .register(meterRegistry);
    }
    
    // 记录配置发布指标
    public <T> T recordConfigPublish(Supplier<T> operation) {
        configPublishCounter.increment();
        return configPublishTimer.record(operation);
    }
    
    // 记录配置查询指标
    public <T> T recordConfigQuery(Supplier<T> operation) {
        configQueryCounter.increment();
        return configQueryTimer.record(operation);
    }
    
    // 记录错误
    public void recordError(String errorType) {
        errorCounter.tag("type", errorType).increment();
    }
    
    // 获取活跃客户端数量
    public double getActiveClientCount() {
        // 实现获取活跃客户端数量的逻辑
        return 0.0;
    }
}
```

### 告警规则配置

```yaml
# Prometheus告警规则配置
groups:
- name: apollo.rules
  rules:
  # 配置发布失败告警
  - alert: ApolloConfigPublishFailure
    expr: increase(apollo_error_total{type="config_publish"}[5m]) > 10
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Apollo配置发布失败"
      description: "过去5分钟内配置发布失败次数超过10次"

  # 配置查询延迟告警
  - alert: ApolloConfigQueryHighLatency
    expr: apollo_config_query_latency > 1000
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Apollo配置查询延迟过高"
      description: "配置查询平均延迟超过1秒"

  # 客户端连接异常告警
  - alert: ApolloClientConnectionIssue
    expr: apollo_client_active < 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Apollo客户端连接异常"
      description: "活跃客户端数量异常"

  # 数据库连接池告警
  - alert: ApolloDatabaseConnectionPoolExhausted
    expr: hikaricp_connections_active{pool="ApolloConfigDB"} > 0.9 * hikaricp_connections_max{pool="ApolloConfigDB"}
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Apollo数据库连接池即将耗尽"
      description: "数据库连接池使用率超过90%"
```

### 健康检查端点

```java
// Apollo健康检查端点
@RestController
@RequestMapping("/actuator/health")
public class ApolloHealthEndpoint {
    
    @Autowired
    private DatabaseHealthIndicator databaseHealthIndicator;
    
    @Autowired
    private ConfigServiceHealthIndicator configServiceHealthIndicator;
    
    @Autowired
    private ClientConnectionHealthIndicator clientConnectionHealthIndicator;
    
    // 综合健康检查
    @GetMapping
    public Health checkHealth() {
        Health.Builder builder = Health.up();
        
        // 检查数据库健康
        Health databaseHealth = databaseHealthIndicator.health();
        if (databaseHealth.getStatus() != Status.UP) {
            builder.down().withDetail("database", databaseHealth);
        }
        
        // 检查配置服务健康
        Health configServiceHealth = configServiceHealthIndicator.health();
        if (configServiceHealth.getStatus() != Status.UP) {
            builder.down().withDetail("configService", configServiceHealth);
        }
        
        // 检查客户端连接健康
        Health clientHealth = clientConnectionHealthIndicator.health();
        if (clientHealth.getStatus() != Status.UP) {
            builder.down().withDetail("clientConnection", clientHealth);
        }
        
        return builder.build();
    }
    
    // 数据库健康检查
    @Component
    public static class DatabaseHealthIndicator implements HealthIndicator {
        @Autowired
        private DataSource dataSource;
        
        @Override
        public Health health() {
            try (Connection connection = dataSource.getConnection()) {
                if (connection.isValid(1)) {
                    // 检查表是否存在
                    DatabaseMetaData metaData = connection.getMetaData();
                    ResultSet tables = metaData.getTables(null, null, "App", null);
                    if (tables.next()) {
                        return Health.up().withDetail("database", "Available").build();
                    } else {
                        return Health.down().withDetail("database", "Missing required tables").build();
                    }
                } else {
                    return Health.down().withDetail("database", "Connection invalid").build();
                }
            } catch (Exception e) {
                return Health.down().withDetail("database", e.getMessage()).build();
            }
        }
    }
    
    // 配置服务健康检查
    @Component
    public static class ConfigServiceHealthIndicator implements HealthIndicator {
        @Autowired
        private ConfigService configService;
        
        @Override
        public Health health() {
            try {
                // 检查配置服务是否正常响应
                boolean isHealthy = configService.isHealthy();
                if (isHealthy) {
                    return Health.up().withDetail("configService", "Available").build();
                } else {
                    return Health.down().withDetail("configService", "Not responding").build();
                }
            } catch (Exception e) {
                return Health.down().withDetail("configService", e.getMessage()).build();
            }
        }
    }
}
```

## 性能优化最佳实践

针对大规模应用场景，需要对Apollo进行性能优化。

### 数据库性能优化

```sql
-- Apollo数据库性能优化
-- 1. 索引优化
CREATE INDEX idx_config_app_cluster_ns ON Config (AppId, Cluster, NamespaceName);
CREATE INDEX idx_release_app_cluster_ns ON Release (AppId, ClusterName, NamespaceName);
CREATE INDEX idx_release_time ON Release (ReleaseTime);

-- 2. 分区表优化
ALTER TABLE Config 
PARTITION BY RANGE (TO_DAYS(CreateTime)) (
    PARTITION p2023_q1 VALUES LESS THAN (TO_DAYS('2023-04-01')),
    PARTITION p2023_q2 VALUES LESS THAN (TO_DAYS('2023-07-01')),
    PARTITION p2023_q3 VALUES LESS THAN (TO_DAYS('2023-10-01')),
    PARTITION p2023_q4 VALUES LESS THAN (TO_DAYS('2024-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 3. 查询优化
-- 优化配置查询SQL
SELECT Key, Value, Comment 
FROM Config 
WHERE AppId = ? AND Cluster = ? AND NamespaceName = ? 
ORDER BY Id;

-- 添加查询提示
SELECT /*+ USE_INDEX(Config, idx_config_app_cluster_ns) */ Key, Value, Comment 
FROM Config 
WHERE AppId = ? AND Cluster = ? AND NamespaceName = ?;
```

### 缓存策略优化

```java
// Apollo缓存策略优化
@Configuration
public class ApolloCacheConfiguration {
    
    // 多级缓存配置
    @Bean
    public CacheManager cacheManager() {
        CompositeCacheManager cacheManager = new CompositeCacheManager();
        
        // L1缓存 - 内存缓存
        CaffeineCacheManager l1CacheManager = new CaffeineCacheManager();
        l1CacheManager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .recordStats());
            
        // L2缓存 - Redis缓存
        RedisCacheManager l2CacheManager = RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(
                    new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer())))
            .build();
            
        cacheManager.setCacheManagers(Arrays.asList(l1CacheManager, l2CacheManager));
        return cacheManager;
    }
    
    // 缓存预热策略
    @Service
    public class CacheWarmupService {
        
        @EventListener(ApplicationReadyEvent.class)
        public void warmupCache() {
            // 应用启动时预热热点配置
            List<HotConfig> hotConfigs = getHotConfigs();
            for (HotConfig config : hotConfigs) {
                preloadConfig(config.getAppId(), config.getCluster(), config.getNamespace());
            }
        }
        
        private void preloadConfig(String appId, String cluster, String namespace) {
            try {
                Config config = configService.loadConfig(appId, cluster, namespace);
                configCache.put(buildCacheKey(appId, cluster, namespace), config);
            } catch (Exception e) {
                logger.warn("Failed to preload config: {}/{}/{}", appId, cluster, namespace, e);
            }
        }
    }
}
```

### 客户端性能优化

```java
// Apollo客户端性能优化
public class OptimizedApolloClient {
    
    // 批量配置获取
    public Map<String, Config> batchGetConfigs(List<ConfigKey> configKeys) {
        Map<String, Config> result = new HashMap<>();
        
        // 按应用分组，减少网络请求
        Map<String, List<ConfigKey>> groupedKeys = configKeys.stream()
            .collect(Collectors.groupingBy(ConfigKey::getAppId));
            
        for (Map.Entry<String, List<ConfigKey>> entry : groupedKeys.entrySet()) {
            String appId = entry.getKey();
            List<ConfigKey> keys = entry.getValue();
            
            // 批量获取配置
            Map<String, Config> batchResult = configService.batchGetConfigs(appId, keys);
            result.putAll(batchResult);
        }
        
        return result;
    }
    
    // 异步配置更新
    public CompletableFuture<Void> asyncRefreshConfigs(List<ConfigKey> configKeys) {
        return CompletableFuture.runAsync(() -> {
            for (ConfigKey key : configKeys) {
                try {
                    Config config = configService.loadConfig(
                        key.getAppId(), key.getCluster(), key.getNamespace());
                    configCache.put(buildCacheKey(key), config);
                } catch (Exception e) {
                    logger.warn("Failed to refresh config: {}", key, e);
                }
            }
        });
    }
    
    // 配置变更合并
    public class ConfigChangeMerger {
        private final Map<ConfigKey, List<ConfigChange>> pendingChanges = new ConcurrentHashMap<>();
        private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(2);
        
        public void addChange(ConfigKey key, ConfigChange change) {
            pendingChanges.computeIfAbsent(key, k -> new ArrayList<>()).add(change);
        }
        
        // 定期合并变更通知
        @PostConstruct
        public void startMergeScheduler() {
            executor.scheduleAtFixedRate(this::mergeAndNotify, 0, 100, TimeUnit.MILLISECONDS);
        }
        
        private void mergeAndNotify() {
            Map<ConfigKey, List<ConfigChange>> changesToNotify = new HashMap<>(pendingChanges);
            pendingChanges.clear();
            
            for (Map.Entry<ConfigKey, List<ConfigChange>> entry : changesToNotify.entrySet()) {
                ConfigKey key = entry.getKey();
                List<ConfigChange> changes = entry.getValue();
                
                if (changes.size() > 1) {
                    // 合并多个变更
                    ConfigChange mergedChange = mergeChanges(changes);
                    notifyConfigChange(key, mergedChange);
                } else if (!changes.isEmpty()) {
                    // 单个变更直接通知
                    notifyConfigChange(key, changes.get(0));
                }
            }
        }
    }
}
```

## 运维管理最佳实践

完善的运维管理体系确保Apollo的稳定运行。

### 自动化部署脚本

```bash
#!/bin/bash
# Apollo自动化部署脚本

# 配置变量
APOLLO_VERSION="2.0.0"
DEPLOY_ENV="production"
CONFIG_SERVICE_HOSTS=("config-1.company.com" "config-2.company.com")
ADMIN_SERVICE_HOSTS=("admin-1.company.com" "admin-2.company.com")
PORTAL_HOSTS=("portal-1.company.com" "portal-2.company.com")

# 部署函数
deploy_config_service() {
    local host=$1
    echo "Deploying Config Service to $host"
    
    # 备份现有配置
    ssh $host "cp -r /opt/apollo/config-service /opt/apollo/config-service.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 上传新版本
    scp apollo-configservice-${APOLLO_VERSION}.jar $host:/opt/apollo/config-service/
    
    # 更新配置文件
    scp config/application-github.properties $host:/opt/apollo/config-service/
    
    # 重启服务
    ssh $host "cd /opt/apollo/config-service && ./scripts/shutdown.sh && ./scripts/startup.sh"
    
    # 等待服务启动
    sleep 30
    
    # 健康检查
    if curl -s --head http://$host:8080/health | grep "200 OK" > /dev/null; then
        echo "Config Service on $host deployed successfully"
    else
        echo "Config Service on $host deployment failed"
        return 1
    fi
}

# 滚动升级
rolling_upgrade() {
    local services=("$@")
    
    for host in "${services[@]}"; do
        echo "Upgrading $host"
        
        # 将节点从负载均衡器中移除
        remove_from_lb $host
        
        # 部署新版本
        deploy_config_service $host
        
        # 将节点添加回负载均衡器
        add_to_lb $host
        
        # 等待一段时间再升级下一个节点
        sleep 60
    done
}

# 数据库迁移
migrate_database() {
    echo "Migrating database schema"
    
    # 执行数据库迁移脚本
    mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD ApolloConfigDB < sql/apollo-migration-${APOLLO_VERSION}.sql
    
    echo "Database migration completed"
}

# 主部署流程
main() {
    echo "Starting Apollo deployment for version $APOLLO_VERSION in $DEPLOY_ENV environment"
    
    # 1. 数据库迁移
    migrate_database
    
    # 2. 滚动升级Config Service
    rolling_upgrade "${CONFIG_SERVICE_HOSTS[@]}"
    
    # 3. 滚动升级Admin Service
    rolling_upgrade "${ADMIN_SERVICE_HOSTS[@]}"
    
    # 4. 滚动升级Portal
    rolling_upgrade "${PORTAL_HOSTS[@]}"
    
    echo "Apollo deployment completed successfully"
}

# 执行主流程
main "$@"
```

### 备份与恢复策略

```bash
#!/bin/bash
# Apollo备份与恢复脚本

# 备份配置
BACKUP_DIR="/backup/apollo"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="apollo_backup_${DATE}"

# 数据库备份
backup_database() {
    echo "Backing up Apollo database"
    
    mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD \
        --single-transaction \
        --routines \
        --triggers \
        ApolloConfigDB > ${BACKUP_DIR}/${BACKUP_NAME}_db.sql
    
    # 压缩备份文件
    gzip ${BACKUP_DIR}/${BACKUP_NAME}_db.sql
    
    echo "Database backup completed: ${BACKUP_DIR}/${BACKUP_NAME}_db.sql.gz"
}

# 配置文件备份
backup_config_files() {
    echo "Backing up configuration files"
    
    # 备份Config Service配置
    tar -czf ${BACKUP_DIR}/${BACKUP_NAME}_config-service.tar.gz \
        -C /opt/apollo/config-service application-github.properties
    
    # 备份Admin Service配置
    tar -czf ${BACKUP_DIR}/${BACKUP_NAME}_admin-service.tar.gz \
        -C /opt/apollo/admin-service application-github.properties
    
    # 备份Portal配置
    tar -czf ${BACKUP_DIR}/${BACKUP_NAME}_portal.tar.gz \
        -C /opt/apollo/portal application-github.properties
    
    echo "Configuration files backup completed"
}

# 恢复数据库
restore_database() {
    local backup_file=$1
    
    echo "Restoring Apollo database from $backup_file"
    
    # 解压备份文件
    gunzip -c $backup_file | mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD ApolloConfigDB
    
    echo "Database restore completed"
}

# 恢复配置文件
restore_config_files() {
    local backup_file=$1
    local service_type=$2
    
    echo "Restoring $service_type configuration files from $backup_file"
    
    case $service_type in
        config-service)
            tar -xzf $backup_file -C /opt/apollo/config-service
            ;;
        admin-service)
            tar -xzf $backup_file -C /opt/apollo/admin-service
            ;;
        portal)
            tar -xzf $backup_file -C /opt/apollo/portal
            ;;
    esac
    
    echo "$service_type configuration files restore completed"
}

# 定期备份任务
schedule_backup() {
    # 添加到crontab
    echo "0 2 * * * $SCRIPT_DIR/apollo-backup.sh backup" >> /var/spool/cron/root
    
    echo "Backup scheduled successfully"
}
```

## 安全最佳实践

企业级Apollo部署必须重视安全防护。

### 配置加密

```java
// Apollo配置加密实现
@Service
public class ConfigEncryptionService {
    
    // 加密算法配置
    @Value("${apollo.encryption.algorithm:AES}")
    private String algorithm;
    
    @Value("${apollo.encryption.key:default_key}")
    private String encryptionKey;
    
    // 加密配置项
    public String encryptConfigValue(String plainValue) {
        try {
            if (algorithm.equals("AES")) {
                return encryptWithAES(plainValue);
            } else if (algorithm.equals("RSA")) {
                return encryptWithRSA(plainValue);
            }
            throw new UnsupportedOperationException("Unsupported encryption algorithm: " + algorithm);
        } catch (Exception e) {
            throw new RuntimeException("Failed to encrypt config value", e);
        }
    }
    
    // 解密配置项
    public String decryptConfigValue(String encryptedValue) {
        try {
            if (algorithm.equals("AES")) {
                return decryptWithAES(encryptedValue);
            } else if (algorithm.equals("RSA")) {
                return decryptWithRSA(encryptedValue);
            }
            throw new UnsupportedOperationException("Unsupported encryption algorithm: " + algorithm);
        } catch (Exception e) {
            throw new RuntimeException("Failed to decrypt config value", e);
        }
    }
    
    private String encryptWithAES(String plainValue) throws Exception {
        Cipher cipher = Cipher.getInstance("AES");
        SecretKeySpec keySpec = new SecretKeySpec(encryptionKey.getBytes(), "AES");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec);
        
        byte[] encrypted = cipher.doFinal(plainValue.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(encrypted);
    }
    
    private String decryptWithAES(String encryptedValue) throws Exception {
        Cipher cipher = Cipher.getInstance("AES");
        SecretKeySpec keySpec = new SecretKeySpec(encryptionKey.getBytes(), "AES");
        cipher.init(Cipher.DECRYPT_MODE, keySpec);
        
        byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedValue));
        return new String(decrypted, StandardCharsets.UTF_8);
    }
    
    // 敏感配置标识
    public static class SensitiveConfig {
        private Set<String> sensitiveKeys = new HashSet<>(Arrays.asList(
            "password", "secret", "key", "token", "credential"
        ));
        
        public boolean isSensitive(String key) {
            return sensitiveKeys.stream().anyMatch(key::contains);
        }
    }
}
```

### 审计日志

```java
// Apollo审计日志实现
@Service
public class ConfigAuditService {
    
    @Autowired
    private AuditLogRepository auditLogRepository;
    
    // 审计日志实体
    public static class AuditLog {
        private Long id;
        private String userId;
        private String appId;
        private String cluster;
        private String namespace;
        private String operation;
        private String oldValue;
        private String newValue;
        private String ipAddress;
        private Date timestamp;
        private String userAgent;
        
        // getters and setters
    }
    
    // 记录配置变更审计日志
    @EventListener
    public void handleConfigChangeEvent(ConfigChangeEvent event) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(event.getOperator());
        auditLog.setAppId(event.getAppId());
        auditLog.setCluster(event.getCluster());
        auditLog.setNamespace(event.getNamespace());
        auditLog.setOperation("CONFIG_CHANGE");
        auditLog.setOldValue(serializeConfigItems(event.getOldConfigItems()));
        auditLog.setNewValue(serializeConfigItems(event.getNewConfigItems()));
        auditLog.setIpAddress(getClientIpAddress());
        auditLog.setTimestamp(new Date());
        auditLog.setUserAgent(getUserAgent());
        
        auditLogRepository.save(auditLog);
    }
    
    // 记录用户登录审计日志
    public void logUserLogin(String userId, String ipAddress, String userAgent) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUserId(userId);
        auditLog.setOperation("USER_LOGIN");
        auditLog.setIpAddress(ipAddress);
        auditLog.setTimestamp(new Date());
        auditLog.setUserAgent(userAgent);
        
        auditLogRepository.save(auditLog);
    }
    
    // 查询审计日志
    public List<AuditLog> queryAuditLogs(String appId, String cluster, String namespace, 
                                       Date startTime, Date endTime, int page, int size) {
        return auditLogRepository.findByCriteria(appId, cluster, namespace, startTime, endTime, page, size);
    }
    
    // 导出审计日志
    public void exportAuditLogs(String appId, Date startTime, Date endTime, OutputStream outputStream) {
        List<AuditLog> logs = auditLogRepository.findByAppIdAndTimeRange(appId, startTime, endTime);
        
        try (CSVWriter writer = new CSVWriter(new OutputStreamWriter(outputStream))) {
            // 写入CSV头部
            writer.writeNext(new String[]{"Timestamp", "User", "App", "Cluster", "Namespace", "Operation", "IP"});
            
            // 写入审计日志数据
            for (AuditLog log : logs) {
                writer.writeNext(new String[]{
                    log.getTimestamp().toString(),
                    log.getUserId(),
                    log.getAppId(),
                    log.getCluster(),
                    log.getNamespace(),
                    log.getOperation(),
                    log.getIpAddress()
                });
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to export audit logs", e);
        }
    }
}
```

## 总结

Apollo企业级最佳实践涵盖了从部署架构到安全防护的全方位内容：

1. **高可用部署**：通过多实例、多数据中心部署确保服务的高可用性
2. **权限管理**：基于RBAC模型实现细粒度的权限控制
3. **监控告警**：建立完善的监控指标体系和告警机制
4. **性能优化**：通过数据库优化、缓存策略等手段提升系统性能
5. **运维管理**：制定自动化部署、备份恢复等运维流程
6. **安全防护**：实现配置加密、审计日志等安全措施

通过遵循这些最佳实践，企业可以构建稳定、安全、高效的Apollo配置管理体系，为业务系统的稳定运行提供有力保障。