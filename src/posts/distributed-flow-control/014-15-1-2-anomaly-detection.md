---
title: "异常流量自动识别与防护: 结合机器学习识别CC攻击等异常模式并自动限流"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在现代分布式系统中，异常流量（如DDoS攻击、CC攻击、爬虫等）已成为系统稳定性的重大威胁。传统的基于阈值的限流策略难以有效识别和防护这些复杂的异常流量模式。通过引入机器学习技术，我们可以构建智能化的异常流量识别与防护系统，自动检测并阻止异常请求，保障系统的正常运行。本章将深入探讨如何结合机器学习技术实现异常流量的自动识别与防护。

## 异常流量识别概述

### 异常流量类型

在分布式系统中，常见的异常流量类型包括：

1. **DDoS攻击**：分布式拒绝服务攻击，通过大量请求耗尽系统资源
2. **CC攻击**：Challenge Collapsar攻击，针对应用层的攻击
3. **恶意爬虫**：高频爬取网站内容的自动化程序
4. **暴力破解**：尝试大量用户名密码组合的攻击
5. **API滥用**：超出正常使用模式的API调用
6. **扫描攻击**：探测系统漏洞的自动化扫描

### 机器学习在异常检测中的应用

机器学习在异常流量识别中具有以下优势：

1. **自适应性**：能够适应正常流量模式的变化
2. **复杂模式识别**：可以识别复杂的异常模式
3. **自动化**：减少人工配置和调整的需求
4. **实时性**：支持实时检测和响应

## 异常检测算法实现

### Isolation Forest算法

Isolation Forest（孤立森林）是一种高效的异常检测算法，特别适用于高维数据的异常检测。

```java
// Isolation Forest异常检测实现
@Component
public class IsolationForestAnomalyDetector {
    private final IsolationForestModel model;
    private final RedisTemplate<String, String> redisTemplate;
    private final ScheduledExecutorService modelUpdateScheduler = Executors.newScheduledThreadPool(1);
    
    public IsolationForestAnomalyDetector(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.model = new IsolationForestModel(100, 256); // 100棵树，子采样大小256
        
        // 定期更新模型
        modelUpdateScheduler.scheduleAtFixedRate(this::updateModel, 
            0, 3600, TimeUnit.SECONDS); // 每小时更新一次模型
    }
    
    public AnomalyDetectionResult detectAnomaly(RequestFeatures features) {
        try {
            // 提取特征向量
            double[] featureVector = features.toVector();
            
            // 使用孤立森林检测异常
            double anomalyScore = model.anomalyScore(featureVector);
            
            // 判断是否为异常
            boolean isAnomaly = anomalyScore > model.getThreshold();
            
            return AnomalyDetectionResult.builder()
                .anomalyScore(anomalyScore)
                .isAnomaly(isAnomaly)
                .confidence(calculateConfidence(anomalyScore))
                .build();
        } catch (Exception e) {
            log.error("Failed to detect anomaly for features: " + features, e);
            return AnomalyDetectionResult.normal();
        }
    }
    
    private void updateModel() {
        try {
            log.info("Updating Isolation Forest model...");
            
            // 从Redis获取历史正常流量数据
            List<RequestFeatures> normalSamples = getNormalSamples(10000);
            
            // 提取特征向量
            List<double[]> featureVectors = normalSamples.stream()
                .map(RequestFeatures::toVector)
                .collect(Collectors.toList());
                
            // 重新训练模型
            model.train(featureVectors);
            
            // 更新阈值
            updateThreshold(normalSamples);
            
            log.info("Isolation Forest model updated successfully");
        } catch (Exception e) {
            log.error("Failed to update Isolation Forest model", e);
        }
    }
    
    private List<RequestFeatures> getNormalSamples(int count) {
        try {
            // 从Redis获取历史正常流量数据
            String key = "traffic:normal_samples";
            List<String> samples = redisTemplate.opsForList().range(key, 0, count - 1);
            
            return samples.stream()
                .map(this::deserializeFeatures)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get normal samples", e);
            return new ArrayList<>();
        }
    }
    
    private RequestFeatures deserializeFeatures(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(json, RequestFeatures.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize features: " + json, e);
            return null;
        }
    }
    
    private void updateThreshold(List<RequestFeatures> normalSamples) {
        try {
            // 计算正常样本的异常分数
            List<Double> scores = normalSamples.stream()
                .map(features -> model.anomalyScore(features.toVector()))
                .sorted()
                .collect(Collectors.toList());
                
            // 设置阈值为95%分位数
            int index = (int) (scores.size() * 0.95);
            double threshold = scores.get(Math.min(index, scores.size() - 1));
            
            model.setThreshold(threshold * 1.2); // 留有一定余量
        } catch (Exception e) {
            log.warn("Failed to update threshold", e);
        }
    }
    
    private double calculateConfidence(double anomalyScore) {
        // 根据异常分数计算置信度
        double threshold = model.getThreshold();
        if (anomalyScore <= threshold) {
            return 0.0; // 正常流量
        }
        
        // 置信度随着异常分数的增加而增加
        return Math.min(1.0, (anomalyScore - threshold) / threshold);
    }
    
    // 孤立森林模型实现
    public static class IsolationForestModel {
        private final int numTrees;
        private final int subSampleSize;
        private final List<IsolationTree> trees;
        private double threshold;
        
        public IsolationForestModel(int numTrees, int subSampleSize) {
            this.numTrees = numTrees;
            this.subSampleSize = subSampleSize;
            this.trees = new ArrayList<>();
            this.threshold = 0.5; // 默认阈值
        }
        
        public void train(List<double[]> samples) {
            trees.clear();
            
            // 构建多棵孤立树
            for (int i = 0; i < numTrees; i++) {
                // 随机采样子集
                List<double[]> subSample = randomSample(samples, subSampleSize);
                
                // 构建孤立树
                IsolationTree tree = new IsolationTree();
                tree.build(subSample);
                trees.add(tree);
            }
        }
        
        public double anomalyScore(double[] features) {
            if (trees.isEmpty()) {
                return 0.0;
            }
            
            // 计算所有树的平均路径长度
            double avgPathLength = trees.stream()
                .mapToDouble(tree -> tree.pathLength(features))
                .average()
                .orElse(0.0);
                
            // 转换为异常分数
            double expectedPathLength = computeExpectedPathLength(subSampleSize);
            return Math.pow(2, -avgPathLength / expectedPathLength);
        }
        
        private List<double[]> randomSample(List<double[]> samples, int size) {
            if (samples.size() <= size) {
                return new ArrayList<>(samples);
            }
            
            Collections.shuffle(samples);
            return samples.subList(0, size);
        }
        
        private double computeExpectedPathLength(int n) {
            // 计算期望路径长度
            if (n <= 1) {
                return 0;
            }
            return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
        }
        
        // getter和setter方法
        public double getThreshold() { return threshold; }
        public void setThreshold(double threshold) { this.threshold = threshold; }
    }
    
    // 孤立树实现
    public static class IsolationTree {
        private Node root;
        
        public void build(List<double[]> samples) {
            if (samples.isEmpty()) {
                return;
            }
            
            root = buildTree(samples, 0);
        }
        
        private Node buildTree(List<double[]> samples, int depth) {
            if (samples.size() <= 1 || depth > 50) { // 最大深度限制
                return new Node(samples.size(), depth);
            }
            
            // 随机选择分割维度
            int splitDimension = new Random().nextInt(samples.get(0).length);
            
            // 计算分割值范围
            double min = samples.stream().mapToDouble(s -> s[splitDimension]).min().orElse(0);
            double max = samples.stream().mapToDouble(s -> s[splitDimension]).max().orElse(1);
            
            if (min == max) {
                return new Node(samples.size(), depth);
            }
            
            // 随机选择分割值
            double splitValue = min + new Random().nextDouble() * (max - min);
            
            // 分割样本
            List<double[]> leftSamples = new ArrayList<>();
            List<double[]> rightSamples = new ArrayList<>();
            
            for (double[] sample : samples) {
                if (sample[splitDimension] < splitValue) {
                    leftSamples.add(sample);
                } else {
                    rightSamples.add(sample);
                }
            }
            
            // 递归构建子树
            Node node = new Node();
            node.splitDimension = splitDimension;
            node.splitValue = splitValue;
            node.left = buildTree(leftSamples, depth + 1);
            node.right = buildTree(rightSamples, depth + 1);
            
            return node;
        }
        
        public double pathLength(double[] features) {
            return pathLength(root, features, 0);
        }
        
        private double pathLength(Node node, double[] features, int depth) {
            if (node.isLeaf()) {
                return depth + computeExpectedPathLength(node.size);
            }
            
            if (features[node.splitDimension] < node.splitValue) {
                return pathLength(node.left, features, depth + 1);
            } else {
                return pathLength(node.right, features, depth + 1);
            }
        }
        
        // 树节点
        public static class Node {
            private int size;
            private int depth;
            private int splitDimension;
            private double splitValue;
            private Node left;
            private Node right;
            
            public Node() {}
            
            public Node(int size, int depth) {
                this.size = size;
                this.depth = depth;
            }
            
            public boolean isLeaf() {
                return left == null && right == null;
            }
        }
    }
    
    // 异常检测结果
    @Data
    @Builder
    public static class AnomalyDetectionResult {
        private double anomalyScore;
        private boolean isAnomaly;
        private double confidence;
        
        public static AnomalyDetectionResult normal() {
            return AnomalyDetectionResult.builder()
                .anomalyScore(0.0)
                .isAnomaly(false)
                .confidence(0.0)
                .build();
        }
    }
}
```

### One-Class SVM算法

One-Class SVM是另一种常用的异常检测算法，特别适用于高维空间的异常检测。

```java
// One-Class SVM异常检测实现
@Component
public class OneClassSvmAnomalyDetector {
    private final OneClassSvmModel model;
    private final RedisTemplate<String, String> redisTemplate;
    private final ScheduledExecutorService modelUpdateScheduler = Executors.newScheduledThreadPool(1);
    
    public OneClassSvmAnomalyDetector(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.model = new OneClassSvmModel(0.1, 0.1); // nu=0.1, gamma=0.1
        
        // 定期更新模型
        modelUpdateScheduler.scheduleAtFixedRate(this::updateModel, 
            1800, 3600, TimeUnit.SECONDS); // 30分钟后开始，每小时更新一次
    }
    
    public AnomalyDetectionResult detectAnomaly(RequestFeatures features) {
        try {
            // 提取特征向量
            double[] featureVector = features.toVector();
            
            // 使用One-Class SVM检测异常
            double decisionValue = model.decisionFunction(featureVector);
            
            // 判断是否为异常（决策值小于0表示异常）
            boolean isAnomaly = decisionValue < 0;
            
            return AnomalyDetectionResult.builder()
                .anomalyScore(-decisionValue) // 转换为正数表示异常程度
                .isAnomaly(isAnomaly)
                .confidence(calculateConfidence(decisionValue))
                .build();
        } catch (Exception e) {
            log.error("Failed to detect anomaly with One-Class SVM for features: " + features, e);
            return AnomalyDetectionResult.normal();
        }
    }
    
    private void updateModel() {
        try {
            log.info("Updating One-Class SVM model...");
            
            // 从Redis获取历史正常流量数据
            List<RequestFeatures> normalSamples = getNormalSamples(5000);
            
            // 提取特征向量
            List<double[]> featureVectors = normalSamples.stream()
                .map(RequestFeatures::toVector)
                .collect(Collectors.toList());
                
            // 重新训练模型
            model.train(featureVectors);
            
            log.info("One-Class SVM model updated successfully");
        } catch (Exception e) {
            log.error("Failed to update One-Class SVM model", e);
        }
    }
    
    private List<RequestFeatures> getNormalSamples(int count) {
        try {
            // 从Redis获取历史正常流量数据
            String key = "traffic:normal_samples";
            List<String> samples = redisTemplate.opsForList().range(key, 0, count - 1);
            
            return samples.stream()
                .map(this::deserializeFeatures)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get normal samples", e);
            return new ArrayList<>();
        }
    }
    
    private RequestFeatures deserializeFeatures(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(json, RequestFeatures.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize features: " + json, e);
            return null;
        }
    }
    
    private double calculateConfidence(double decisionValue) {
        // 根据决策值计算置信度
        // 决策值越负，置信度越高
        return Math.min(1.0, Math.max(0.0, -decisionValue / 10.0));
    }
    
    // One-Class SVM模型实现（简化版）
    public static class OneClassSvmModel {
        private final double nu;
        private final double gamma;
        private List<SupportVector> supportVectors;
        private double rho;
        
        public OneClassSvmModel(double nu, double gamma) {
            this.nu = nu;
            this.gamma = gamma;
            this.supportVectors = new ArrayList<>();
        }
        
        public void train(List<double[]> samples) {
            // 简化的训练过程
            // 实际实现中需要使用SMO算法或其他优化算法
            
            // 这里我们使用简化的实现
            supportVectors.clear();
            
            // 随机选择一些样本作为支持向量
            Random random = new Random();
            int numSupportVectors = Math.min(100, samples.size() / 10);
            
            for (int i = 0; i < numSupportVectors; i++) {
                int index = random.nextInt(samples.size());
                double[] sample = samples.get(index);
                double alpha = random.nextDouble() * 0.1; // 随机alpha值
                
                supportVectors.add(new SupportVector(sample, alpha));
            }
            
            // 设置rho值
            this.rho = 0.1;
        }
        
        public double decisionFunction(double[] features) {
            if (supportVectors.isEmpty()) {
                return 1.0; // 默认为正常
            }
            
            // 计算决策函数值
            double sum = 0.0;
            for (SupportVector sv : supportVectors) {
                double kernelValue = rbfKernel(sv.features, features, gamma);
                sum += sv.alpha * kernelValue;
            }
            
            return sum - rho;
        }
        
        private double rbfKernel(double[] x1, double[] x2, double gamma) {
            // RBF核函数
            double sum = 0.0;
            for (int i = 0; i < x1.length; i++) {
                double diff = x1[i] - x2[i];
                sum += diff * diff;
            }
            return Math.exp(-gamma * sum);
        }
        
        // 支持向量
        public static class SupportVector {
            private final double[] features;
            private final double alpha;
            
            public SupportVector(double[] features, double alpha) {
                this.features = features;
                this.alpha = alpha;
            }
        }
    }
}
```

## 多算法融合检测

### 集成学习框架

```java
// 多算法融合异常检测
@Component
public class EnsembleAnomalyDetector {
    private final IsolationForestAnomalyDetector isolationForestDetector;
    private final OneClassSvmAnomalyDetector svmDetector;
    private final RedisTemplate<String, String> redisTemplate;
    
    public EnsembleAnomalyDetector(IsolationForestAnomalyDetector isolationForestDetector,
                                 OneClassSvmAnomalyDetector svmDetector,
                                 RedisTemplate<String, String> redisTemplate) {
        this.isolationForestDetector = isolationForestDetector;
        this.svmDetector = svmDetector;
        this.redisTemplate = redisTemplate;
    }
    
    public AnomalyDetectionResult detectAnomaly(RequestFeatures features) {
        try {
            // 使用多个算法进行检测
            AnomalyDetectionResult ifResult = isolationForestDetector.detectAnomaly(features);
            AnomalyDetectionResult svmResult = svmDetector.detectAnomaly(features);
            
            // 融合多个算法的结果
            return fuseResults(ifResult, svmResult);
        } catch (Exception e) {
            log.error("Failed to detect anomaly with ensemble method for features: " + features, e);
            return AnomalyDetectionResult.normal();
        }
    }
    
    private AnomalyDetectionResult fuseResults(AnomalyDetectionResult ifResult,
                                             AnomalyDetectionResult svmResult) {
        // 加权融合策略
        double ifWeight = 0.6; // Isolation Forest权重
        double svmWeight = 0.4; // SVM权重
        
        // 融合异常分数
        double fusedScore = ifResult.getAnomalyScore() * ifWeight + 
                           svmResult.getAnomalyScore() * svmWeight;
        
        // 融合置信度
        double fusedConfidence = ifResult.getConfidence() * ifWeight + 
                                svmResult.getConfidence() * svmWeight;
        
        // 判断是否为异常
        boolean isAnomaly = ifResult.isAnomaly() || svmResult.isAnomaly();
        
        return AnomalyDetectionResult.builder()
            .anomalyScore(fusedScore)
            .isAnomaly(isAnomaly)
            .confidence(fusedConfidence)
            .build();
    }
    
    // 动态权重调整
    public void adjustWeights() {
        try {
            // 从Redis获取最近的检测结果和实际标签
            List<DetectionRecord> recentRecords = getRecentDetectionRecords(1000);
            
            // 计算各算法的准确率
            AlgorithmAccuracy ifAccuracy = calculateAccuracy(recentRecords, "isolation_forest");
            AlgorithmAccuracy svmAccuracy = calculateAccuracy(recentRecords, "svm");
            
            // 根据准确率调整权重
            double totalAccuracy = ifAccuracy.getAccuracy() + svmAccuracy.getAccuracy();
            if (totalAccuracy > 0) {
                double ifWeight = ifAccuracy.getAccuracy() / totalAccuracy;
                double svmWeight = svmAccuracy.getAccuracy() / totalAccuracy;
                
                log.info("Adjusted weights - Isolation Forest: {}, SVM: {}", ifWeight, svmWeight);
                // 实际实现中需要更新权重配置
            }
        } catch (Exception e) {
            log.warn("Failed to adjust algorithm weights", e);
        }
    }
    
    private List<DetectionRecord> getRecentDetectionRecords(int count) {
        try {
            String key = "anomaly:detection_records";
            List<String> records = redisTemplate.opsForList().range(key, 0, count - 1);
            
            return records.stream()
                .map(this::deserializeRecord)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to get detection records", e);
            return new ArrayList<>();
        }
    }
    
    private DetectionRecord deserializeRecord(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(json, DetectionRecord.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize detection record: " + json, e);
            return null;
        }
    }
    
    private AlgorithmAccuracy calculateAccuracy(List<DetectionRecord> records, String algorithm) {
        long truePositives = 0;
        long falsePositives = 0;
        long falseNegatives = 0;
        
        for (DetectionRecord record : records) {
            boolean predictedAnomaly = record.isAnomaly(algorithm);
            boolean actualAnomaly = record.isActuallyAnomaly();
            
            if (predictedAnomaly && actualAnomaly) {
                truePositives++;
            } else if (predictedAnomaly && !actualAnomaly) {
                falsePositives++;
            } else if (!predictedAnomaly && actualAnomaly) {
                falseNegatives++;
            }
        }
        
        double precision = (truePositives + falsePositives) > 0 ? 
            (double) truePositives / (truePositives + falsePositives) : 0;
        double recall = (truePositives + falseNegatives) > 0 ? 
            (double) truePositives / (truePositives + falseNegatives) : 0;
        double f1Score = (precision + recall) > 0 ? 
            2 * precision * recall / (precision + recall) : 0;
            
        return new AlgorithmAccuracy(precision, recall, f1Score);
    }
    
    // 检测记录
    public static class DetectionRecord {
        private String requestId;
        private Map<String, Boolean> algorithmResults;
        private boolean actuallyAnomaly;
        private long timestamp;
        
        public boolean isAnomaly(String algorithm) {
            return algorithmResults.getOrDefault(algorithm, false);
        }
        
        // getter和setter方法
        public boolean isActuallyAnomaly() { return actuallyAnomaly; }
        public void setActuallyAnomaly(boolean actuallyAnomaly) { this.actuallyAnomaly = actuallyAnomaly; }
    }
    
    // 算法准确率
    public static class AlgorithmAccuracy {
        private final double precision;
        private final double recall;
        private final double f1Score;
        
        public AlgorithmAccuracy(double precision, double recall, double f1Score) {
            this.precision = precision;
            this.recall = recall;
            this.f1Score = f1Score;
        }
        
        public double getAccuracy() {
            return f1Score; // 使用F1分数作为准确率指标
        }
    }
}
```

## 自动防护机制

### 动态黑名单管理

```java
// 动态黑名单管理
@Component
public class DynamicBlacklistManager {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScheduledExecutorService cleanupScheduler = Executors.newScheduledThreadPool(1);
    
    public DynamicBlacklistManager(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        
        // 定期清理过期的黑名单记录
        cleanupScheduler.scheduleAtFixedRate(this::cleanupExpiredEntries, 
            3600, 3600, TimeUnit.SECONDS); // 每小时执行一次
    }
    
    public boolean isBlacklisted(String identifier) {
        try {
            String key = "blacklist:" + identifier;
            String value = redisTemplate.opsForValue().get(key);
            return value != null && !"0".equals(value);
        } catch (Exception e) {
            log.warn("Failed to check blacklist for identifier: " + identifier, e);
            return false;
        }
    }
    
    public void addToBlacklist(String identifier, long duration, String reason) {
        try {
            String key = "blacklist:" + identifier;
            String value = System.currentTimeMillis() + ":" + reason;
            
            // 添加到黑名单
            redisTemplate.opsForValue().set(key, value, Duration.ofSeconds(duration));
            
            // 记录到黑名单历史
            recordBlacklistHistory(identifier, duration, reason);
            
            log.info("Added {} to blacklist for {} seconds. Reason: {}", 
                identifier, duration, reason);
        } catch (Exception e) {
            log.error("Failed to add {} to blacklist", identifier, e);
        }
    }
    
    public void removeFromBlacklist(String identifier) {
        try {
            String key = "blacklist:" + identifier;
            redisTemplate.delete(key);
            
            log.info("Removed {} from blacklist", identifier);
        } catch (Exception e) {
            log.error("Failed to remove {} from blacklist", identifier, e);
        }
    }
    
    public BlacklistInfo getBlacklistInfo(String identifier) {
        try {
            String key = "blacklist:" + identifier;
            String value = redisTemplate.opsForValue().get(key);
            
            if (value == null || "0".equals(value)) {
                return BlacklistInfo.notBlacklisted();
            }
            
            String[] parts = value.split(":");
            if (parts.length >= 2) {
                long expirationTime = Long.parseLong(parts[0]);
                String reason = parts[1];
                long remainingTime = Math.max(0, expirationTime - System.currentTimeMillis());
                
                return BlacklistInfo.builder()
                    .blacklisted(true)
                    .reason(reason)
                    .expirationTime(expirationTime)
                    .remainingTime(remainingTime)
                    .build();
            }
        } catch (Exception e) {
            log.warn("Failed to get blacklist info for identifier: " + identifier, e);
        }
        
        return BlacklistInfo.notBlacklisted();
    }
    
    private void recordBlacklistHistory(String identifier, long duration, String reason) {
        try {
            BlacklistHistory history = BlacklistHistory.builder()
                .identifier(identifier)
                .duration(duration)
                .reason(reason)
                .timestamp(System.currentTimeMillis())
                .build();
                
            String key = "blacklist:history:" + identifier;
            String value = serializeHistory(history);
            
            // 保留最近10条记录
            redisTemplate.opsForList().leftPush(key, value);
            redisTemplate.opsForList().trim(key, 0, 9);
        } catch (Exception e) {
            log.warn("Failed to record blacklist history for identifier: " + identifier, e);
        }
    }
    
    private String serializeHistory(BlacklistHistory history) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(history);
        } catch (Exception e) {
            log.warn("Failed to serialize blacklist history", e);
            return "";
        }
    }
    
    private void cleanupExpiredEntries() {
        try {
            log.info("Cleaning up expired blacklist entries...");
            
            // 获取所有黑名单键
            Set<String> keys = redisTemplate.keys("blacklist:*");
            if (keys == null || keys.isEmpty()) {
                return;
            }
            
            long currentTime = System.currentTimeMillis();
            long removedCount = 0;
            
            for (String key : keys) {
                try {
                    String value = redisTemplate.opsForValue().get(key);
                    if (value != null && !value.isEmpty() && !value.equals("0")) {
                        String[] parts = value.split(":");
                        if (parts.length > 0) {
                            long expirationTime = Long.parseLong(parts[0]);
                            if (expirationTime < currentTime) {
                                redisTemplate.delete(key);
                                removedCount++;
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to process blacklist key: " + key, e);
                }
            }
            
            log.info("Cleaned up {} expired blacklist entries", removedCount);
        } catch (Exception e) {
            log.error("Failed to cleanup expired blacklist entries", e);
        }
    }
    
    // 黑名单信息
    @Data
    @Builder
    public static class BlacklistInfo {
        private boolean blacklisted;
        private String reason;
        private long expirationTime;
        private long remainingTime;
        
        public static BlacklistInfo notBlacklisted() {
            return BlacklistInfo.builder()
                .blacklisted(false)
                .reason("")
                .expirationTime(0)
                .remainingTime(0)
                .build();
        }
    }
    
    // 黑名单历史记录
    @Data
    @Builder
    public static class BlacklistHistory {
        private String identifier;
        private long duration;
        private String reason;
        private long timestamp;
    }
}
```

### 自适应防护策略

```java
// 自适应防护策略
@Component
public class AdaptiveProtectionStrategy {
    private final DynamicBlacklistManager blacklistManager;
    private final RedisTemplate<String, String> redisTemplate;
    private final ScheduledExecutorService strategyUpdateScheduler = Executors.newScheduledThreadPool(1);
    
    public AdaptiveProtectionStrategy(DynamicBlacklistManager blacklistManager,
                                    RedisTemplate<String, String> redisTemplate) {
        this.blacklistManager = blacklistManager;
        this.redisTemplate = redisTemplate;
        
        // 定期更新防护策略
        strategyUpdateScheduler.scheduleAtFixedRate(this::updateProtectionStrategy, 
            0, 1800, TimeUnit.SECONDS); // 每30分钟更新一次策略
    }
    
    public ProtectionDecision makeProtectionDecision(RequestContext context, 
                                                   AnomalyDetectionResult detectionResult) {
        try {
            // 1. 检查是否已在黑名单中
            if (blacklistManager.isBlacklisted(context.getIdentifier())) {
                return ProtectionDecision.block("Already blacklisted");
            }
            
            // 2. 根据异常检测结果决定防护措施
            if (detectionResult.isAnomaly()) {
                return handleAnomaly(context, detectionResult);
            }
            
            // 3. 正常流量，允许通过
            return ProtectionDecision.allow();
        } catch (Exception e) {
            log.error("Failed to make protection decision for context: " + context, e);
            // 出错时保守处理，允许通过
            return ProtectionDecision.allow();
        }
    }
    
    private ProtectionDecision handleAnomaly(RequestContext context, 
                                          AnomalyDetectionResult detectionResult) {
        try {
            String identifier = context.getIdentifier();
            double confidence = detectionResult.getConfidence();
            double anomalyScore = detectionResult.getAnomalyScore();
            
            // 根据置信度和异常分数决定防护措施
            if (confidence > 0.9 && anomalyScore > 0.8) {
                // 高置信度高异常分数，直接加入黑名单
                long duration = calculateBlacklistDuration(confidence, anomalyScore);
                blacklistManager.addToBlacklist(identifier, duration, "High confidence anomaly");
                return ProtectionDecision.block("High confidence anomaly detected");
            } else if (confidence > 0.7 && anomalyScore > 0.6) {
                // 中等置信度，加入临时黑名单
                blacklistManager.addToBlacklist(identifier, 300, "Medium confidence anomaly"); // 5分钟
                return ProtectionDecision.challenge("Medium confidence anomaly detected");
            } else if (confidence > 0.5 && anomalyScore > 0.4) {
                // 低置信度，记录并监控
                recordSuspiciousActivity(context, detectionResult);
                return ProtectionDecision.monitor("Low confidence anomaly detected");
            } else {
                // 置信度较低，允许通过但记录
                recordSuspiciousActivity(context, detectionResult);
                return ProtectionDecision.allow();
            }
        } catch (Exception e) {
            log.error("Failed to handle anomaly for context: " + context, e);
            return ProtectionDecision.allow();
        }
    }
    
    private long calculateBlacklistDuration(double confidence, double anomalyScore) {
        // 根据置信度和异常分数计算黑名单持续时间
        // 基础时间：60秒
        long baseDuration = 60;
        
        // 根据置信度调整
        double confidenceFactor = Math.min(1.0, confidence / 0.9); // 以0.9为基准
        
        // 根据异常分数调整
        double scoreFactor = Math.min(1.0, anomalyScore / 0.8); // 以0.8为基准
        
        // 计算最终持续时间（最大24小时）
        return Math.min(86400, (long) (baseDuration * confidenceFactor * scoreFactor * 10));
    }
    
    private void recordSuspiciousActivity(RequestContext context, 
                                        AnomalyDetectionResult detectionResult) {
        try {
            SuspiciousActivity activity = SuspiciousActivity.builder()
                .identifier(context.getIdentifier())
                .requestContext(context)
                .anomalyScore(detectionResult.getAnomalyScore())
                .confidence(detectionResult.getConfidence())
                .timestamp(System.currentTimeMillis())
                .build();
                
            String key = "suspicious:activity:" + context.getIdentifier();
            String value = serializeActivity(activity);
            
            // 保留最近100条记录
            redisTemplate.opsForList().leftPush(key, value);
            redisTemplate.opsForList().trim(key, 0, 99);
            
            // 如果可疑活动频繁，考虑加入黑名单
            checkAndBlacklistIfNecessary(context.getIdentifier());
        } catch (Exception e) {
            log.warn("Failed to record suspicious activity for context: " + context, e);
        }
    }
    
    private void checkAndBlacklistIfNecessary(String identifier) {
        try {
            String key = "suspicious:activity:" + identifier;
            long count = redisTemplate.opsForList().size(key);
            
            // 如果最近有超过10次可疑活动，加入黑名单
            if (count > 10) {
                blacklistManager.addToBlacklist(identifier, 1800, "Frequent suspicious activity"); // 30分钟
                log.info("Added {} to blacklist due to frequent suspicious activity", identifier);
            }
        } catch (Exception e) {
            log.warn("Failed to check and blacklist for identifier: " + identifier, e);
        }
    }
    
    private String serializeActivity(SuspiciousActivity activity) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(activity);
        } catch (Exception e) {
            log.warn("Failed to serialize suspicious activity", e);
            return "";
        }
    }
    
    private void updateProtectionStrategy() {
        try {
            log.info("Updating protection strategy...");
            
            // 根据历史数据调整策略参数
            adjustStrategyParameters();
            
            log.info("Protection strategy updated successfully");
        } catch (Exception e) {
            log.error("Failed to update protection strategy", e);
        }
    }
    
    private void adjustStrategyParameters() {
        try {
            // 从Redis获取历史防护决策数据
            List<ProtectionDecisionRecord> recentDecisions = getRecentDecisions(1000);
            
            // 分析决策效果
            DecisionAnalysis analysis = analyzeDecisions(recentDecisions);
            
            // 根据分析结果调整策略阈值
            log.info("Decision analysis: {}", analysis);
            // 实际实现中会根据分析结果调整各种阈值参数
            
        } catch (Exception e) {
            log.warn("Failed to adjust strategy parameters", e);
        }
    }
    
    private List<ProtectionDecisionRecord> getRecentDecisions(int count) {
        // 实现获取最近防护决策记录的逻辑
        return new ArrayList<>();
    }
    
    private DecisionAnalysis analyzeDecisions(List<ProtectionDecisionRecord> decisions) {
        // 实现决策分析逻辑
        return new DecisionAnalysis();
    }
    
    // 防护决策
    @Data
    @Builder
    public static class ProtectionDecision {
        private DecisionType type;
        private String reason;
        
        public static ProtectionDecision allow() {
            return ProtectionDecision.builder()
                .type(DecisionType.ALLOW)
                .reason("Normal traffic")
                .build();
        }
        
        public static ProtectionDecision block(String reason) {
            return ProtectionDecision.builder()
                .type(DecisionType.BLOCK)
                .reason(reason)
                .build();
        }
        
        public static ProtectionDecision challenge(String reason) {
            return ProtectionDecision.builder()
                .type(DecisionType.CHALLENGE)
                .reason(reason)
                .build();
        }
        
        public static ProtectionDecision monitor(String reason) {
            return ProtectionDecision.builder()
                .type(DecisionType.MONITOR)
                .reason(reason)
                .build();
        }
    }
    
    // 决策类型枚举
    public enum DecisionType {
        ALLOW, BLOCK, CHALLENGE, MONITOR
    }
    
    // 可疑活动记录
    @Data
    @Builder
    public static class SuspiciousActivity {
        private String identifier;
        private RequestContext requestContext;
        private double anomalyScore;
        private double confidence;
        private long timestamp;
    }
    
    // 决策分析结果
    public static class DecisionAnalysis {
        // 实现决策分析结果
    }
}
```

## 请求特征提取

### 特征工程实现

```java
// 请求特征提取
@Component
public class RequestFeatureExtractor {
    private final RedisTemplate<String, String> redisTemplate;
    
    public RequestFeatureExtractor(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    public RequestFeatures extractFeatures(HttpServletRequest request, 
                                        RequestContext context) {
        RequestFeatures features = new RequestFeatures();
        
        // 1. 基础特征
        features.setHttpMethod(request.getMethod());
        features.setRequestUri(request.getRequestURI());
        features.setUserAgent(request.getHeader("User-Agent"));
        features.setReferer(request.getHeader("Referer"));
        features.setIpAddress(context.getClientIp());
        
        // 2. 频率特征
        extractFrequencyFeatures(features, context);
        
        // 3. 行为特征
        extractBehaviorFeatures(features, request, context);
        
        // 4. 内容特征
        extractContentFeatures(features, request);
        
        // 5. 时间特征
        extractTimeFeatures(features);
        
        return features;
    }
    
    private void extractFrequencyFeatures(RequestFeatures features, RequestContext context) {
        try {
            String identifier = context.getIdentifier();
            long currentTime = System.currentTimeMillis();
            
            // 计算请求频率（过去1分钟）
            String key = "traffic:frequency:" + identifier;
            Long requestCount = redisTemplate.opsForValue().increment(key, 1);
            redisTemplate.expire(key, 60, TimeUnit.SECONDS); // 1分钟过期
            
            features.setRequestFrequency(requestCount != null ? requestCount.intValue() : 0);
            
            // 计算不同URI访问频率
            String uriKey = "traffic:uri_frequency:" + identifier + ":" + features.getRequestUri();
            Long uriCount = redisTemplate.opsForValue().increment(uriKey, 1);
            redisTemplate.expire(uriKey, 300, TimeUnit.SECONDS); // 5分钟过期
            
            features.setUriFrequency(uriCount != null ? uriCount.intValue() : 0);
            
            // 计算错误请求频率
            if (context.getStatusCode() >= 400) {
                String errorKey = "traffic:error_frequency:" + identifier;
                Long errorCount = redisTemplate.opsForValue().increment(errorKey, 1);
                redisTemplate.expire(errorKey, 60, TimeUnit.SECONDS);
                
                features.setErrorFrequency(errorCount != null ? errorCount.intValue() : 0);
            }
        } catch (Exception e) {
            log.warn("Failed to extract frequency features", e);
        }
    }
    
    private void extractBehaviorFeatures(RequestFeatures features, 
                                       HttpServletRequest request, 
                                       RequestContext context) {
        try {
            // 检查是否使用了常见攻击模式
            String userAgent = features.getUserAgent();
            features.setSuspiciousUserAgent(isSuspiciousUserAgent(userAgent));
            
            // 检查请求头是否完整
            features.setMissingHeaders(countMissingHeaders(request));
            
            // 检查请求参数
            features.setParameterCount(countParameters(request));
            features.setSuspiciousParameters(hasSuspiciousParameters(request));
            
            // 检查请求速度
            features.setRequestSpeed(calculateRequestSpeed(context));
        } catch (Exception e) {
            log.warn("Failed to extract behavior features", e);
        }
    }
    
    private void extractContentFeatures(RequestFeatures features, HttpServletRequest request) {
        try {
            // 检查Content-Type
            String contentType = request.getContentType();
            features.setContentType(contentType);
            
            // 检查请求体大小
            if (request.getContentLength() > 0) {
                features.setContentLength(request.getContentLength());
            }
            
            // 检查是否包含可疑内容
            features.setSuspiciousContent(hasSuspiciousContent(request));
        } catch (Exception e) {
            log.warn("Failed to extract content features", e);
        }
    }
    
    private void extractTimeFeatures(RequestFeatures features) {
        try {
            LocalDateTime now = LocalDateTime.now();
            features.setHour(now.getHour());
            features.setDayOfWeek(now.getDayOfWeek().getValue());
            features.setIsWeekend(now.getDayOfWeek() == DayOfWeek.SATURDAY || 
                                now.getDayOfWeek() == DayOfWeek.SUNDAY);
        } catch (Exception e) {
            log.warn("Failed to extract time features", e);
        }
    }
    
    private boolean isSuspiciousUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) {
            return true;
        }
        
        // 检查是否为常见的爬虫或自动化工具
        String lowerUserAgent = userAgent.toLowerCase();
        return lowerUserAgent.contains("bot") || 
               lowerUserAgent.contains("crawler") || 
               lowerUserAgent.contains("spider") ||
               lowerUserAgent.contains("scanner");
    }
    
    private int countMissingHeaders(HttpServletRequest request) {
        int missing = 0;
        
        // 检查常见的重要请求头是否存在
        if (request.getHeader("Accept") == null) missing++;
        if (request.getHeader("Accept-Language") == null) missing++;
        if (request.getHeader("Accept-Encoding") == null) missing++;
        if (request.getHeader("User-Agent") == null) missing++;
        
        return missing;
    }
    
    private int countParameters(HttpServletRequest request) {
        int count = 0;
        
        // 计算查询参数数量
        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isEmpty()) {
            count += queryString.split("&").length;
        }
        
        // 计算表单参数数量
        if ("POST".equalsIgnoreCase(request.getMethod())) {
            try {
                count += request.getParameterMap().size();
            } catch (Exception e) {
                log.warn("Failed to get parameter map", e);
            }
        }
        
        return count;
    }
    
    private boolean hasSuspiciousParameters(HttpServletRequest request) {
        // 检查参数中是否包含常见的攻击模式
        Map<String, String[]> parameterMap = request.getParameterMap();
        
        for (Map.Entry<String, String[]> entry : parameterMap.entrySet()) {
            String paramName = entry.getKey();
            String[] paramValues = entry.getValue();
            
            // 检查参数名
            if (isSuspiciousParameterName(paramName)) {
                return true;
            }
            
            // 检查参数值
            for (String paramValue : paramValues) {
                if (isSuspiciousParameterValue(paramValue)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    private boolean isSuspiciousParameterName(String paramName) {
        if (paramName == null) return false;
        
        String lowerParamName = paramName.toLowerCase();
        return lowerParamName.contains("select") ||
               lowerParamName.contains("union") ||
               lowerParamName.contains("script") ||
               lowerParamName.contains("eval");
    }
    
    private boolean isSuspiciousParameterValue(String paramValue) {
        if (paramValue == null) return false;
        
        String lowerParamValue = paramValue.toLowerCase();
        return lowerParamValue.contains("<script") ||
               lowerParamValue.contains("javascript:") ||
               lowerParamValue.contains("eval(") ||
               lowerParamValue.matches(".*\\b(select|union|insert|update|delete)\\b.*");
    }
    
    private double calculateRequestSpeed(RequestContext context) {
        try {
            String identifier = context.getIdentifier();
            long currentTime = System.currentTimeMillis();
            
            // 获取上次请求时间
            String key = "traffic:last_request_time:" + identifier;
            String lastRequestTimeStr = redisTemplate.opsForValue().get(key);
            
            if (lastRequestTimeStr != null) {
                long lastRequestTime = Long.parseLong(lastRequestTimeStr);
                long timeDiff = currentTime - lastRequestTime;
                
                // 更新最后请求时间
                redisTemplate.opsForValue().set(key, String.valueOf(currentTime), 
                    Duration.ofSeconds(300)); // 5分钟过期
                    
                // 返回请求间隔（毫秒）
                return timeDiff;
            } else {
                // 第一次请求
                redisTemplate.opsForValue().set(key, String.valueOf(currentTime), 
                    Duration.ofSeconds(300));
                return 0;
            }
        } catch (Exception e) {
            log.warn("Failed to calculate request speed", e);
            return 0;
        }
    }
    
    private boolean hasSuspiciousContent(HttpServletRequest request) {
        try {
            // 检查请求体内容
            if (request.getContentLength() > 0) {
                String contentType = request.getContentType();
                if (contentType != null && contentType.contains("application/json")) {
                    // 对于JSON请求，检查是否包含可疑内容
                    String body = getRequestBody(request);
                    if (body != null) {
                        return isSuspiciousJsonContent(body);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to check suspicious content", e);
        }
        
        return false;
    }
    
    private String getRequestBody(HttpServletRequest request) {
        try {
            StringBuilder body = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;
            
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
            
            return body.toString();
        } catch (Exception e) {
            log.warn("Failed to read request body", e);
            return null;
        }
    }
    
    private boolean isSuspiciousJsonContent(String jsonContent) {
        // 检查JSON内容中是否包含可疑模式
        if (jsonContent == null) return false;
        
        String lowerContent = jsonContent.toLowerCase();
        return lowerContent.contains("<script") ||
               lowerContent.contains("javascript:") ||
               lowerContent.contains("eval(") ||
               lowerContent.matches(".*\\b(select|union|insert|update|delete)\\b.*");
    }
}
```

## 防护系统集成

### 统一防护入口

```java
// 统一异常流量防护入口
@Component
public class UnifiedAnomalyProtection {
    private final EnsembleAnomalyDetector ensembleDetector;
    private final RequestFeatureExtractor featureExtractor;
    private final AdaptiveProtectionStrategy protectionStrategy;
    private final DynamicBlacklistManager blacklistManager;
    private final RedisTemplate<String, String> redisTemplate;
    
    public UnifiedAnomalyProtection(EnsembleAnomalyDetector ensembleDetector,
                                  RequestFeatureExtractor featureExtractor,
                                  AdaptiveProtectionStrategy protectionStrategy,
                                  DynamicBlacklistManager blacklistManager,
                                  RedisTemplate<String, String> redisTemplate) {
        this.ensembleDetector = ensembleDetector;
        this.featureExtractor = featureExtractor;
        this.protectionStrategy = protectionStrategy;
        this.blacklistManager = blacklistManager;
        this.redisTemplate = redisTemplate;
    }
    
    public ProtectionResult protect(HttpServletRequest request, 
                                  HttpServletResponse response) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. 构建请求上下文
            RequestContext context = buildRequestContext(request, response);
            
            // 2. 检查黑名单
            if (blacklistManager.isBlacklisted(context.getIdentifier())) {
                BlacklistInfo blacklistInfo = blacklistManager.getBlacklistInfo(context.getIdentifier());
                return ProtectionResult.blocked("Blocked by blacklist: " + blacklistInfo.getReason());
            }
            
            // 3. 提取请求特征
            RequestFeatures features = featureExtractor.extractFeatures(request, context);
            
            // 4. 保存正常流量样本（用于模型训练）
            saveNormalSample(features, context);
            
            // 5. 异常检测
            AnomalyDetectionResult detectionResult = ensembleDetector.detectAnomaly(features);
            
            // 6. 防护决策
            AdaptiveProtectionStrategy.ProtectionDecision decision = 
                protectionStrategy.makeProtectionDecision(context, detectionResult);
            
            // 7. 执行防护措施
            ProtectionResult result = executeProtectionDecision(decision, context, detectionResult);
            
            // 8. 记录防护日志
            recordProtectionEvent(context, features, detectionResult, decision, result, startTime);
            
            return result;
        } catch (Exception e) {
            log.error("Failed to protect request", e);
            // 出错时保守处理，允许通过
            return ProtectionResult.allowed();
        }
    }
    
    private RequestContext buildRequestContext(HttpServletRequest request, 
                                            HttpServletResponse response) {
        return RequestContext.builder()
            .requestId(UUID.randomUUID().toString())
            .clientIp(getClientIp(request))
            .userAgent(request.getHeader("User-Agent"))
            .requestUri(request.getRequestURI())
            .httpMethod(request.getMethod())
            .timestamp(System.currentTimeMillis())
            .build();
    }
    
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }
    
    private void saveNormalSample(RequestFeatures features, RequestContext context) {
        try {
            // 只保存正常流量样本用于训练
            if (context.getStatusCode() < 400) {
                String key = "traffic:normal_samples";
                String value = serializeFeatures(features);
                
                // 保留最近10000个样本
                redisTemplate.opsForList().leftPush(key, value);
                redisTemplate.opsForList().trim(key, 0, 9999);
            }
        } catch (Exception e) {
            log.warn("Failed to save normal sample", e);
        }
    }
    
    private String serializeFeatures(RequestFeatures features) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(features);
        } catch (Exception e) {
            log.warn("Failed to serialize features", e);
            return "";
        }
    }
    
    private ProtectionResult executeProtectionDecision(
            AdaptiveProtectionStrategy.ProtectionDecision decision,
            RequestContext context,
            AnomalyDetectionResult detectionResult) {
        
        switch (decision.getType()) {
            case ALLOW:
                return ProtectionResult.allowed();
                
            case BLOCK:
                // 记录被阻止的请求
                recordBlockedRequest(context, detectionResult);
                return ProtectionResult.blocked(decision.getReason());
                
            case CHALLENGE:
                // 实施挑战（如验证码）
                return ProtectionResult.challenged(decision.getReason());
                
            case MONITOR:
                // 监控模式，允许通过但记录
                return ProtectionResult.monitored(decision.getReason());
                
            default:
                return ProtectionResult.allowed();
        }
    }
    
    private void recordBlockedRequest(RequestContext context, 
                                   AnomalyDetectionResult detectionResult) {
        try {
            BlockedRequest blockedRequest = BlockedRequest.builder()
                .requestId(context.getRequestId())
                .clientIp(context.getClientIp())
                .requestUri(context.getRequestUri())
                .anomalyScore(detectionResult.getAnomalyScore())
                .confidence(detectionResult.getConfidence())
                .timestamp(System.currentTimeMillis())
                .build();
                
            String key = "anomaly:blocked_requests";
            String value = serializeBlockedRequest(blockedRequest);
            
            redisTemplate.opsForList().leftPush(key, value);
            redisTemplate.opsForList().trim(key, 0, 999); // 保留最近1000条记录
        } catch (Exception e) {
            log.warn("Failed to record blocked request", e);
        }
    }
    
    private String serializeBlockedRequest(BlockedRequest blockedRequest) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(blockedRequest);
        } catch (Exception e) {
            log.warn("Failed to serialize blocked request", e);
            return "";
        }
    }
    
    private void recordProtectionEvent(RequestContext context,
                                     RequestFeatures features,
                                     AnomalyDetectionResult detectionResult,
                                     AdaptiveProtectionStrategy.ProtectionDecision decision,
                                     ProtectionResult result,
                                     long startTime) {
        try {
            long duration = System.currentTimeMillis() - startTime;
            
            ProtectionEvent event = ProtectionEvent.builder()
                .requestId(context.getRequestId())
                .clientIp(context.getClientIp())
                .requestUri(context.getRequestUri())
                .anomalyScore(detectionResult.getAnomalyScore())
                .confidence(detectionResult.getConfidence())
                .decisionType(decision.getType())
                .resultType(result.getType())
                .processingTime(duration)
                .timestamp(System.currentTimeMillis())
                .build();
                
            // 发送到监控系统
            sendToMonitoringSystem(event);
            
            // 记录到日志
            log.info("Protection event - IP: {}, URI: {}, Decision: {}, Result: {}, Time: {}ms",
                context.getClientIp(), context.getRequestUri(), 
                decision.getType(), result.getType(), duration);
        } catch (Exception e) {
            log.warn("Failed to record protection event", e);
        }
    }
    
    private void sendToMonitoringSystem(ProtectionEvent event) {
        // 实现发送到监控系统的逻辑
        // 可以发送到Prometheus、ELK等监控系统
    }
    
    // 防护结果
    @Data
    @Builder
    public static class ProtectionResult {
        private ResultType type;
        private String reason;
        
        public static ProtectionResult allowed() {
            return ProtectionResult.builder()
                .type(ResultType.ALLOWED)
                .reason("Normal traffic")
                .build();
        }
        
        public static ProtectionResult blocked(String reason) {
            return ProtectionResult.builder()
                .type(ResultType.BLOCKED)
                .reason(reason)
                .build();
        }
        
        public static ProtectionResult challenged(String reason) {
            return ProtectionResult.builder()
                .type(ResultType.CHALLENGED)
                .reason(reason)
                .build();
        }
        
        public static ProtectionResult monitored(String reason) {
            return ProtectionResult.builder()
                .type(ResultType.MONITORED)
                .reason(reason)
                .build();
        }
    }
    
    // 结果类型枚举
    public enum ResultType {
        ALLOWED, BLOCKED, CHALLENGED, MONITORED
    }
    
    // 被阻止的请求记录
    @Data
    @Builder
    public static class BlockedRequest {
        private String requestId;
        private String clientIp;
        private String requestUri;
        private double anomalyScore;
        private double confidence;
        private long timestamp;
    }
    
    // 防护事件
    @Data
    @Builder
    public static class ProtectionEvent {
        private String requestId;
        private String clientIp;
        private String requestUri;
        private double anomalyScore;
        private double confidence;
        private AdaptiveProtectionStrategy.DecisionType decisionType;
        private ResultType resultType;
        private long processingTime;
        private long timestamp;
    }
}
```

## 最佳实践总结

### 1. 算法选择与组合

- **多算法融合**：结合Isolation Forest和One-Class SVM等不同算法的优势
- **动态权重调整**：根据算法在实际应用中的表现动态调整权重
- **特征工程**：精心设计特征提取方法，提高检测准确性

### 2. 防护策略优化

- **分层防护**：根据异常程度采取不同的防护措施
- **动态黑名单**：实现智能的黑名单管理机制
- **自适应调整**：根据系统负载和攻击模式动态调整防护策略

### 3. 性能与可扩展性

- **实时处理**：优化算法实现，确保实时检测能力
- **分布式架构**：利用Redis等分布式存储提高系统可扩展性
- **缓存机制**：合理使用缓存减少重复计算

### 4. 监控与运维

- **全面监控**：监控检测准确率、防护效果等关键指标
- **日志记录**：详细记录防护事件，便于分析和审计
- **定期评估**：定期评估防护效果，持续优化系统

通过以上实现，我们可以构建一个智能化的异常流量识别与防护系统，有效应对各种复杂的异常流量攻击，保障分布式系统的稳定运行。