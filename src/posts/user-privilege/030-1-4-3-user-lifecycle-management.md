---
title: "用户生命周期管理: 入职、转岗、离职的自动化流程（HR驱动）"
date: 2025-09-06
categories: [UserPrivilege]
tags: [UserPrivilege]
published: true
---
用户生命周期管理是统一身份治理平台的核心功能之一，它涵盖了从用户入职、在职到离职的完整过程。通过自动化流程和HR系统驱动，企业可以确保在每个阶段都能提供适当的安全控制和访问权限。本文将深入探讨用户生命周期管理的各个阶段，分析关键任务和挑战，并介绍如何通过技术手段实现自动化的生命周期管理。

## 引言

在现代企业环境中，员工的流动性是常态，而用户生命周期管理正是应对这一挑战的关键。一个完善的统一身份治理平台需要能够自动化处理用户从入职、在职到离职的全过程，确保在每个阶段都能提供适当的安全控制和访问权限。

用户生命周期管理不仅关乎用户体验，更是企业安全和合规的重要保障。通过建立完整的生命周期管理流程，企业可以确保用户在任何时候都拥有适当的访问权限，既不过度授权也不授权不足。

## 生命周期管理的核心理念

### 端到端管理

用户生命周期管理强调端到端的管理理念，从用户与企业的第一次接触到最终分离，都需要进行有效的身份管理。这种管理方式确保了身份信息的一致性和安全性。

### 自动化驱动

现代身份治理平台通过自动化技术，能够显著减少人工干预，提高管理效率并降低错误率。自动化不仅体现在流程执行上，还包括策略 enforcement 和异常检测等方面。

### 策略一致性

在整个生命周期中，安全策略和访问控制规则需要保持一致性。无论用户处于哪个阶段，都应该遵循相同的安全标准和合规要求。

### 可追溯性

完整的生命周期管理需要具备良好的可追溯性，能够记录每个阶段的操作和变更，为审计和问题排查提供支持。

## 入职阶段管理

### 预入职准备

#### 信息收集

在员工正式入职前，HR部门需要收集必要的个人信息：

```java
public class PreOnboardingService {
    private HrIntegrationService hrService;
    private UserService userService;
    private NotificationService notificationService;
    
    public PreOnboardingData collectPreOnboardingData(String employeeId) {
        // 从HR系统获取员工信息
        EmployeeData employeeData = hrService.getEmployeeData(employeeId);
        
        PreOnboardingData preOnboardingData = new PreOnboardingData();
        preOnboardingData.setEmployeeId(employeeData.getEmployeeId());
        preOnboardingData.setFullName(employeeData.getFullName());
        preOnboardingData.setEmail(employeeData.getEmail());
        preOnboardingData.setDepartment(employeeData.getDepartment());
        preOnboardingData.setPosition(employeeData.getPosition());
        preOnboardingData.setHireDate(employeeData.getHireDate());
        preOnboardingData.setManagerId(employeeData.getManagerId());
        
        return preOnboardingData;
    }
    
    public void sendPreOnboardingNotification(PreOnboardingData data) {
        // 发送预入职通知
        Map<String, Object> templateData = new HashMap<>();
        templateData.put("fullName", data.getFullName());
        templateData.put("hireDate", data.getHireDate());
        templateData.put("department", data.getDepartment());
        
        notificationService.sendEmail(
            data.getEmail(), 
            "欢迎加入公司 - 预入职指南", 
            "pre-onboarding-welcome-template", 
            templateData
        );
    }
}
```

#### 岗位需求分析

根据员工的岗位职责，确定所需的系统访问权限：

```java
public class PositionRequirementAnalyzer {
    private RoleService roleService;
    private SystemAccessService systemAccessService;
    
    public PositionRequirements analyzePositionRequirements(String position) {
        PositionRequirements requirements = new PositionRequirements();
        
        // 获取岗位对应的角色
        List<Role> roles = roleService.getRolesByPosition(position);
        requirements.setRequiredRoles(roles);
        
        // 获取岗位所需的系统访问权限
        List<SystemAccess> systemAccesses = 
            systemAccessService.getAccessByPosition(position);
        requirements.setRequiredSystemAccess(systemAccesses);
        
        // 获取特殊安全要求
        List<SecurityRequirement> securityRequirements = 
            getSecurityRequirementsByPosition(position);
        requirements.setSecurityRequirements(securityRequirements);
        
        return requirements;
    }
    
    public void createAccessProfile(PositionRequirements requirements) {
        // 创建访问配置文件
        AccessProfile profile = new AccessProfile();
        profile.setName("Profile-" + requirements.getPosition());
        profile.setDescription("Access profile for " + requirements.getPosition());
        profile.setRoles(requirements.getRequiredRoles());
        profile.setSystemAccesses(requirements.getRequiredSystemAccess());
        profile.setSecurityRequirements(requirements.getSecurityRequirements());
        
        accessProfileRepository.save(profile);
    }
}
```

#### 预配置流程

基于收集的信息，提前进行系统配置：

```java
public class PreConfigurationService {
    private UserService userService;
    private AccessManagementService accessService;
    private AssetManagementService assetService;
    
    public PreConfigurationResult preConfigureUser(PreOnboardingData data) {
        PreConfigurationResult result = new PreConfigurationResult();
        
        try {
            // 创建临时用户账号
            User tempUser = createUserAccount(data);
            result.setTempUserId(tempUser.getId());
            
            // 预分配基础权限
            assignBasePermissions(tempUser.getId(), data.getPosition());
            result.setPermissionsAssigned(true);
            
            // 准备工作设备和工具
            List<Asset> assets = prepareAssets(data);
            result.setAssetsPrepared(assets);
            
            // 发送入职指南和培训材料
            sendOnboardingMaterials(data);
            result.setMaterialsSent(true);
            
            result.setSuccess(true);
        } catch (Exception e) {
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            log.error("Pre-configuration failed for employee: " + data.getEmployeeId(), e);
        }
        
        return result;
    }
    
    private User createUserAccount(PreOnboardingData data) {
        UserCreationRequest request = new UserCreationRequest();
        request.setEmployeeId(data.getEmployeeId());
        request.setFullName(data.getFullName());
        request.setEmail(data.getEmail());
        request.setDepartment(data.getDepartment());
        request.setPosition(data.getPosition());
        request.setHireDate(data.getHireDate());
        request.setStatus(UserStatus.PRE_ONBOARDING);
        
        return userService.createUser(request);
    }
}
```

### 正式入职处理

#### 身份验证

确保员工身份的真实性：

```java
public class IdentityVerificationService {
    private DocumentVerificationService documentService;
    private BackgroundCheckService backgroundService;
    
    public IdentityVerificationResult verifyIdentity(OnboardingData data) {
        IdentityVerificationResult result = new IdentityVerificationResult();
        
        // 核实身份证件
        DocumentVerificationResult idResult = 
            documentService.verifyIdDocument(data.getIdDocument());
        result.setIdVerified(idResult.isVerified());
        result.setIdVerificationDetails(idResult.getDetails());
        
        // 验证学历和工作经历
        EducationVerificationResult eduResult = 
            documentService.verifyEducation(data.getEducationDocuments());
        result.setEducationVerified(eduResult.isVerified());
        
        WorkExperienceVerificationResult workResult = 
            documentService.verifyWorkExperience(data.getWorkExperienceDocuments());
        result.setWorkExperienceVerified(workResult.isVerified());
        
        // 进行背景调查（如需要）
        if (requiresBackgroundCheck(data.getPosition())) {
            BackgroundCheckResult backgroundResult = 
                backgroundService.performBackgroundCheck(data.getEmployeeId());
            result.setBackgroundCheckCompleted(backgroundResult.isCompleted());
            result.setBackgroundCheckPassed(backgroundResult.isPassed());
        } else {
            result.setBackgroundCheckCompleted(true);
            result.setBackgroundCheckPassed(true);
        }
        
        // 签署相关协议和合同
        List<Agreement> agreements = getRequiredAgreements(data.getPosition());
        result.setAgreements(agreements);
        
        result.setOverallVerified(
            idResult.isVerified() && 
            eduResult.isVerified() && 
            workResult.isVerified() && 
            result.isBackgroundCheckPassed()
        );
        
        return result;
    }
}
```

#### 账号创建

为员工创建正式的系统账号：

```java
public class UserAccountService {
    private UserService userService;
    private PasswordService passwordService;
    private SecurityPolicyService securityService;
    
    public User createFormalUserAccount(OnboardingData data, IdentityVerificationResult verification) {
        // 生成唯一用户标识
        String userId = generateUserId(data);
        
        // 创建用户对象
        User user = new User();
        user.setId(userId);
        user.setEmployeeId(data.getEmployeeId());
        user.setUsername(data.getEmail().split("@")[0]);
        user.setEmail(data.getEmail());
        user.setFullName(data.getFullName());
        user.setDepartment(data.getDepartment());
        user.setPosition(data.getPosition());
        user.setHireDate(data.getHireDate());
        user.setManagerId(data.getManagerId());
        user.setStatus(UserStatus.ACTIVE);
        user.setCreateTime(new Date());
        
        // 设置初始密码
        String initialPassword = passwordService.generateSecurePassword();
        user.setPassword(passwordService.hashPassword(initialPassword));
        
        // 配置安全策略
        SecurityPolicy policy = securityService.getDefaultPolicy();
        user.setSecurityPolicy(policy);
        
        // 保存用户信息
        User savedUser = userService.saveUser(user);
        
        // 发送账号信息
        sendAccountInformation(savedUser, initialPassword);
        
        return savedUser;
    }
    
    private void sendAccountInformation(User user, String initialPassword) {
        Map<String, Object> templateData = new HashMap<>();
        templateData.put("fullName", user.getFullName());
        templateData.put("username", user.getUsername());
        templateData.put("initialPassword", initialPassword);
        templateData.put("firstLoginUrl", getFirstLoginUrl());
        
        notificationService.sendEmail(
            user.getEmail(),
            "您的系统账号已创建",
            "account-creation-template",
            templateData
        );
    }
}
```

#### 权限授予

根据岗位需求授予相应权限：

```java
public class PermissionAssignmentService {
    private RoleService roleService;
    private AccessManagementService accessService;
    private AuditService auditService;
    
    public void assignPermissionsToNewUser(User user, PositionRequirements requirements) {
        try {
            // 分配角色
            for (Role role : requirements.getRequiredRoles()) {
                roleService.assignRoleToUser(user.getId(), role.getId());
                auditService.logPermissionAssignment(
                    user.getId(), 
                    "ROLE_ASSIGNMENT", 
                    role.getId(), 
                    "ASSIGNED_ON_ONBOARDING"
                );
            }
            
            // 分配系统访问权限
            for (SystemAccess access : requirements.getRequiredSystemAccess()) {
                accessService.grantSystemAccess(user.getId(), access);
                auditService.logPermissionAssignment(
                    user.getId(), 
                    "SYSTEM_ACCESS", 
                    access.getSystemId(), 
                    "ASSIGNED_ON_ONBOARDING"
                );
            }
            
            // 应用安全要求
            applySecurityRequirements(user, requirements.getSecurityRequirements());
            
            // 发送权限确认通知
            sendPermissionConfirmation(user, requirements);
            
        } catch (Exception e) {
            log.error("Failed to assign permissions to user: " + user.getId(), e);
            throw new PermissionAssignmentException("Failed to assign permissions", e);
        }
    }
    
    private void applySecurityRequirements(User user, List<SecurityRequirement> requirements) {
        for (SecurityRequirement requirement : requirements) {
            switch (requirement.getType()) {
                case MFA_REQUIRED:
                    enableMfaForUser(user.getId());
                    break;
                case PASSWORD_POLICY:
                    applyPasswordPolicy(user.getId(), requirement.getPolicy());
                    break;
                case ACCESS_RESTRICTION:
                    applyAccessRestriction(user.getId(), requirement.getRestriction());
                    break;
            }
        }
    }
}
```

#### 环境准备

为员工准备必要的工作环境：

```java
public class EnvironmentSetupService {
    private AssetManagementService assetService;
    private SoftwareProvisioningService softwareService;
    private CommunicationSetupService communicationService;
    
    public EnvironmentSetupResult setupUserEnvironment(User user, OnboardingData data) {
        EnvironmentSetupResult result = new EnvironmentSetupResult();
        
        try {
            // 分配办公设备
            List<Asset> assets = assetService.assignAssetsToUser(
                user.getId(), data.getRequiredAssets());
            result.setAssetsAssigned(assets);
            
            // 配置软件和工具
            List<Software> software = softwareService.installSoftwareForUser(
                user.getId(), data.getRequiredSoftware());
            result.setSoftwareInstalled(software);
            
            // 设置邮箱和通讯工具
            communicationService.setupUserCommunications(user.getId());
            result.setCommunicationsSetup(true);
            
            // 提供访问凭证
            List<Credential> credentials = generateAccessCredentials(user.getId());
            result.setCredentialsProvided(credentials);
            
            result.setSuccess(true);
        } catch (Exception e) {
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            log.error("Environment setup failed for user: " + user.getId(), e);
        }
        
        return result;
    }
    
    private List<Credential> generateAccessCredentials(String userId) {
        List<Credential> credentials = new ArrayList<>();
        
        // 生成系统访问凭证
        SystemCredential systemCredential = new SystemCredential();
        systemCredential.setUserId(userId);
        systemCredential.setCredentialType(CredentialType.SYSTEM_ACCESS);
        systemCredential.setCredentialValue(generateSecureToken());
        systemCredential.setExpiryDate(DateUtils.addDays(new Date(), 30));
        credentials.add(systemCredential);
        
        // 生成应用访问凭证
        ApplicationCredential appCredential = new ApplicationCredential();
        appCredential.setUserId(userId);
        appCredential.setCredentialType(CredentialType.APPLICATION_ACCESS);
        appCredential.setCredentialValue(generateSecureToken());
        appCredential.setExpiryDate(DateUtils.addDays(new Date(), 90));
        credentials.add(appCredential);
        
        // 保存凭证
        for (Credential credential : credentials) {
            credentialService.saveCredential(credential);
        }
        
        return credentials;
    }
}
```

## 在职阶段管理

### 权限动态调整

#### 岗位变动

当员工岗位发生变化时，需要及时调整其权限：

```java
public class PositionChangeService {
    private UserService userService;
    private RoleService roleService;
    private AccessManagementService accessService;
    private AuditService auditService;
    
    public void handlePositionChange(String userId, PositionChangeRequest request) {
        try {
            // 获取用户当前信息
            User user = userService.getUserById(userId);
            String oldPosition = user.getPosition();
            String newPosition = request.getNewPosition();
            
            // 记录岗位变动
            logPositionChange(userId, oldPosition, newPosition, request.getReason());
            
            // 撤销原有岗位的特定权限
            revokeOldPositionPermissions(userId, oldPosition);
            
            // 授予新岗位所需的权限
            grantNewPositionPermissions(userId, newPosition);
            
            // 更新组织归属信息
            updateOrganizationalInfo(userId, request.getNewDepartment(), newPosition);
            
            // 调整审批流程配置
            updateApprovalWorkflows(userId, oldPosition, newPosition);
            
            // 发送变更通知
            sendPositionChangeNotification(user, oldPosition, newPosition);
            
        } catch (Exception e) {
            log.error("Failed to handle position change for user: " + userId, e);
            throw new PositionChangeException("Failed to process position change", e);
        }
    }
    
    private void revokeOldPositionPermissions(String userId, String oldPosition) {
        // 获取旧岗位权限
        PositionRequirements oldRequirements = 
            positionRequirementAnalyzer.analyzePositionRequirements(oldPosition);
        
        // 撤销角色
        for (Role role : oldRequirements.getRequiredRoles()) {
            roleService.revokeRoleFromUser(userId, role.getId());
            auditService.logPermissionRevocation(
                userId, "ROLE_REVOCATION", role.getId(), "POSITION_CHANGE"
            );
        }
        
        // 撤销系统访问权限
        for (SystemAccess access : oldRequirements.getRequiredSystemAccess()) {
            accessService.revokeSystemAccess(userId, access);
            auditService.logPermissionRevocation(
                userId, "SYSTEM_ACCESS_REVOCATION", access.getSystemId(), "POSITION_CHANGE"
            );
        }
    }
    
    private void grantNewPositionPermissions(String userId, String newPosition) {
        // 获取新岗位权限
        PositionRequirements newRequirements = 
            positionRequirementAnalyzer.analyzePositionRequirements(newPosition);
        
        // 分配角色
        for (Role role : newRequirements.getRequiredRoles()) {
            roleService.assignRoleToUser(userId, role.getId());
            auditService.logPermissionAssignment(
                userId, "ROLE_ASSIGNMENT", role.getId(), "POSITION_CHANGE"
            );
        }
        
        // 分配系统访问权限
        for (SystemAccess access : newRequirements.getRequiredSystemAccess()) {
            accessService.grantSystemAccess(userId, access);
            auditService.logPermissionAssignment(
                userId, "SYSTEM_ACCESS", access.getSystemId(), "POSITION_CHANGE"
            );
        }
    }
}
```

#### 项目参与

员工参与特定项目时的权限管理：

```java
public class ProjectParticipationService {
    private ProjectService projectService;
    private TeamManagementService teamService;
    private PermissionService permissionService;
    private AuditService auditService;
    
    public void assignProjectPermissions(String userId, ProjectAssignmentRequest request) {
        try {
            // 创建临时团队或加入现有团队
            DynamicTeam team = getOrCreateProjectTeam(request.getProjectId());
            
            // 添加用户到团队
            TeamMember member = new TeamMember();
            member.setUserId(userId);
            member.setTeamId(team.getTeamId());
            member.setJoinDate(new Date());
            member.setRoleId(request.getRoleInProject());
            member.setStatus(MemberStatus.ACTIVE);
            
            teamService.addTeamMember(team.getTeamId(), member);
            
            // 授予项目相关权限
            grantProjectRelatedPermissions(userId, request.getProjectId(), request.getPermissions());
            
            // 设置项目相关资源访问
            setupProjectResourceAccess(userId, request.getProjectId());
            
            // 设置项目结束后的权限回收
            schedulePermissionRemoval(userId, request.getProjectId(), request.getEndDate());
            
            // 启动安全监控
            enableProjectSecurityMonitoring(userId, request.getProjectId());
            
            // 发送项目参与确认
            sendProjectAssignmentConfirmation(userId, request.getProjectId());
            
        } catch (Exception e) {
            log.error("Failed to assign project permissions for user: " + userId, e);
            throw new ProjectAssignmentException("Failed to assign project permissions", e);
        }
    }
    
    private void grantProjectRelatedPermissions(String userId, String projectId, List<Permission> permissions) {
        for (Permission permission : permissions) {
            permissionService.grantPermissionToUser(userId, permission);
            auditService.logPermissionAssignment(
                userId, 
                "PROJECT_PERMISSION", 
                permission.getId(), 
                "PROJECT_" + projectId
            );
        }
        
        // 创建临时权限记录
        TemporaryPermission tempPermission = new TemporaryPermission();
        tempPermission.setUserId(userId);
        tempPermission.setProjectId(projectId);
        tempPermission.setPermissions(permissions);
        tempPermission.setGrantDate(new Date());
        tempPermission.setExpiryDate(calculateProjectEndDate(projectId));
        tempPermission.setStatus(PermissionStatus.ACTIVE);
        
        temporaryPermissionRepository.save(tempPermission);
    }
    
    private void schedulePermissionRemoval(String userId, String projectId, Date endDate) {
        // 创建定时任务，在项目结束时自动回收权限
        PermissionRemovalTask task = new PermissionRemovalTask();
        task.setUserId(userId);
        task.setProjectId(projectId);
        task.setScheduledTime(endDate);
        task.setStatus(TaskStatus.SCHEDULED);
        
        taskScheduler.scheduleTask(task);
    }
}
```

#### 技能发展

随着员工技能的提升，可能需要调整其权限：

```java
public class SkillDevelopmentService {
    private UserService userService;
    private CertificationService certificationService;
    private PermissionService permissionService;
    private AuditService auditService;
    
    public void updatePermissionsBasedOnSkillDevelopment(String userId, SkillDevelopmentEvent event) {
        try {
            User user = userService.getUserById(userId);
            
            // 根据技能发展更新权限
            switch (event.getEventType()) {
                case CERTIFICATION_OBTAINED:
                    handleCertificationObtained(user, event);
                    break;
                case TRAINING_COMPLETED:
                    handleTrainingCompleted(user, event);
                    break;
                case PROMOTION:
                    handlePromotion(user, event);
                    break;
                case SPECIALIZATION:
                    handleSpecialization(user, event);
                    break;
            }
            
            // 记录技能发展事件
            logSkillDevelopmentEvent(userId, event);
            
            // 发送权限更新通知
            sendPermissionUpdateNotification(user, event);
            
        } catch (Exception e) {
            log.error("Failed to update permissions based on skill development for user: " + userId, e);
            throw new SkillDevelopmentException("Failed to process skill development event", e);
        }
    }
    
    private void handleCertificationObtained(User user, SkillDevelopmentEvent event) {
        // 获取认证对应的角色和权限
        List<Role> certificationRoles = 
            certificationService.getRolesForCertification(event.getCertificationId());
        List<Permission> certificationPermissions = 
            certificationService.getPermissionsForCertification(event.getCertificationId());
        
        // 分配角色
        for (Role role : certificationRoles) {
            roleService.assignRoleToUser(user.getId(), role.getId());
            auditService.logPermissionAssignment(
                user.getId(), "ROLE_ASSIGNMENT", role.getId(), "CERTIFICATION_" + event.getCertificationId()
            );
        }
        
        // 分配权限
        for (Permission permission : certificationPermissions) {
            permissionService.grantPermissionToUser(user.getId(), permission);
            auditService.logPermissionAssignment(
                user.getId(), "CERTIFICATION_PERMISSION", permission.getId(), "CERTIFICATION_" + event.getCertificationId()
            );
        }
    }
    
    private void handleTrainingCompleted(User user, SkillDevelopmentEvent event) {
        // 根据培训内容更新权限
        List<Permission> trainingPermissions = 
            getPermissionsForTraining(event.getTrainingId());
        
        for (Permission permission : trainingPermissions) {
            permissionService.grantPermissionToUser(user.getId(), permission);
            auditService.logPermissionAssignment(
                user.getId(), "TRAINING_PERMISSION", permission.getId(), "TRAINING_" + event.getTrainingId()
            );
        }
    }
}
```

### 定期审查机制

#### 权限审计

定期审查用户的权限分配情况：

```java
public class PermissionAuditService {
    private UserService userService;
    private RoleService roleService;
    private AccessManagementService accessService;
    private AuditService auditService;
    
    public PermissionAuditReport conductRegularPermissionAudit() {
        PermissionAuditReport report = new PermissionAuditReport();
        report.setAuditDate(new Date());
        report.setTotalUsers(userService.getTotalUserCount());
        
        List<User> allUsers = userService.getAllUsers();
        List<AuditFinding> findings = new ArrayList<>();
        
        for (User user : allUsers) {
            try {
                // 检查权限的必要性
                List<UnnecessaryPermission> unnecessaryPermissions = 
                    findUnnecessaryPermissions(user);
                if (!unnecessaryPermissions.isEmpty()) {
                    findings.add(createUnnecessaryPermissionFinding(user, unnecessaryPermissions));
                }
                
                // 识别过度授权问题
                List<OverprivilegedPermission> overprivilegedPermissions = 
                    findOverprivilegedPermissions(user);
                if (!overprivilegedPermissions.isEmpty()) {
                    findings.add(createOverprivilegedFinding(user, overprivilegedPermissions));
                }
                
                // 发现权限缺失情况
                List<MissingPermission> missingPermissions = 
                    findMissingPermissions(user);
                if (!missingPermissions.isEmpty()) {
                    findings.add(createMissingPermissionFinding(user, missingPermissions));
                }
                
                // 确保权限与职责匹配
                PermissionDutyMatchResult matchResult = 
                    checkPermissionDutyMatch(user);
                if (!matchResult.isMatched()) {
                    findings.add(createDutyMismatchFinding(user, matchResult));
                }
                
            } catch (Exception e) {
                log.error("Failed to audit permissions for user: " + user.getId(), e);
                findings.add(createAuditErrorFinding(user, e));
            }
        }
        
        report.setFindings(findings);
        report.setTotalFindings(findings.size());
        report.setCompletionDate(new Date());
        
        // 保存审计报告
        auditReportRepository.save(report);
        
        // 发送审计报告
        sendAuditReport(report);
        
        return report;
    }
    
    private List<UnnecessaryPermission> findUnnecessaryPermissions(User user) {
        List<UnnecessaryPermission> unnecessary = new ArrayList<>();
        
        // 获取用户所有权限
        List<Permission> userPermissions = permissionService.getUserPermissions(user.getId());
        
        for (Permission permission : userPermissions) {
            // 检查权限是否在最近90天内被使用过
            if (!permissionService.wasPermissionUsedRecently(user.getId(), permission.getId(), 90)) {
                // 检查权限是否与用户当前职责相关
                if (!isPermissionRelevantToCurrentRole(user, permission)) {
                    UnnecessaryPermission unnecessaryPermission = new UnnecessaryPermission();
                    unnecessaryPermission.setUserId(user.getId());
                    unnecessaryPermission.setPermissionId(permission.getId());
                    unnecessaryPermission.setReason("Not used recently and not relevant to current role");
                    unnecessaryPermission.setDetectionDate(new Date());
                    unnecessary.add(unnecessaryPermission);
                }
            }
        }
        
        return unnecessary;
    }
    
    private AuditFinding createUnnecessaryPermissionFinding(
        User user, List<UnnecessaryPermission> permissions) {
        AuditFinding finding = new AuditFinding();
        finding.setUserId(user.getId());
        finding.setFindingType(FindingType.UNNECESSARY_PERMISSION);
        finding.setSeverity(FindingSeverity.MEDIUM);
        finding.setDescription("User has unnecessary permissions that are not used or relevant");
        finding.setDetails(permissions.toString());
        finding.setDetectionDate(new Date());
        finding.setStatus(FindingStatus.OPEN);
        return finding;
    }
}
```

#### 合规性检查

确保权限分配符合相关法规要求：

```java
public class ComplianceCheckService {
    private ComplianceRuleService ruleService;
    private UserService userService;
    private PermissionService permissionService;
    private AuditService auditService;
    
    public ComplianceReport performComplianceCheck() {
        ComplianceReport report = new ComplianceReport();
        report.setCheckDate(new Date());
        
        List<ComplianceRule> rules = ruleService.getAllActiveRules();
        List<ComplianceViolation> violations = new ArrayList<>();
        
        for (ComplianceRule rule : rules) {
            try {
                // 执行合规性检查
                List<ComplianceViolation> ruleViolations = executeComplianceRule(rule);
                violations.addAll(ruleViolations);
                
            } catch (Exception e) {
                log.error("Failed to execute compliance rule: " + rule.getId(), e);
                violations.add(createRuleExecutionError(rule, e));
            }
        }
        
        report.setViolations(violations);
        report.setTotalViolations(violations.size());
        report.setComplianceScore(calculateComplianceScore(violations));
        report.setCompletionDate(new Date());
        
        // 保存合规报告
        complianceReportRepository.save(report);
        
        // 发送合规报告
        sendComplianceReport(report);
        
        return report;
    }
    
    private List<ComplianceViolation> executeComplianceRule(ComplianceRule rule) {
        List<ComplianceViolation> violations = new ArrayList<>();
        
        switch (rule.getRuleType()) {
            case DATA_PROTECTION:
                violations.addAll(checkDataProtectionCompliance(rule));
                break;
            case INDUSTRY_STANDARD:
                violations.addAll(checkIndustryStandardCompliance(rule));
                break;
            case INTERNAL_POLICY:
                violations.addAll(checkInternalPolicyCompliance(rule));
                break;
            case REGULATORY_REQUIREMENT:
                violations.addAll(checkRegulatoryCompliance(rule));
                break;
        }
        
        return violations;
    }
    
    private List<ComplianceViolation> checkDataProtectionCompliance(ComplianceRule rule) {
        List<ComplianceViolation> violations = new ArrayList<>();
        
        // 获取所有用户
        List<User> users = userService.getAllUsers();
        
        for (User user : users) {
            // 检查用户是否具有敏感数据访问权限
            List<Permission> sensitivePermissions = 
                permissionService.getSensitiveDataPermissions(user.getId());
            
            for (Permission permission : sensitivePermissions) {
                // 检查用户是否签署了相关数据保护协议
                if (!hasSignedDataProtectionAgreement(user.getId())) {
                    ComplianceViolation violation = new ComplianceViolation();
                    violation.setUserId(user.getId());
                    violation.setRuleId(rule.getId());
                    violation.setViolationType(ViolationType.DATA_PROTECTION);
                    violation.setDescription("User has sensitive data access without signed agreement");
                    violation.setSeverity(ViolationSeverity.HIGH);
                    violation.setDetectionDate(new Date());
                    violations.add(violation);
                }
                
                // 检查用户是否完成了数据保护培训
                if (!hasCompletedDataProtectionTraining(user.getId())) {
                    ComplianceViolation violation = new ComplianceViolation();
                    violation.setUserId(user.getId());
                    violation.setRuleId(rule.getId());
                    violation.setViolationType(ViolationType.DATA_PROTECTION);
                    violation.setDescription("User has sensitive data access without completed training");
                    violation.setSeverity(ViolationSeverity.HIGH);
                    violation.setDetectionDate(new Date());
                    violations.add(violation);
                }
            }
        }
        
        return violations;
    }
}
```

#### 安全评估

定期评估用户的安全风险：

```java
public class SecurityAssessmentService {
    private UserService userService;
    private LoginService loginService;
    private PasswordService passwordService;
    private MfaService mfaService;
    private AuditService auditService;
    
    public SecurityAssessmentReport conductSecurityAssessment() {
        SecurityAssessmentReport report = new SecurityAssessmentReport();
        report.setAssessmentDate(new Date());
        
        List<User> allUsers = userService.getAllUsers();
        List<UserSecurityScore> userScores = new ArrayList<>();
        List<SecurityRisk> identifiedRisks = new ArrayList<>();
        
        for (User user : allUsers) {
            try {
                // 评估用户安全分数
                UserSecurityScore score = calculateUserSecurityScore(user);
                userScores.add(score);
                
                // 识别安全风险
                List<SecurityRisk> userRisks = identifyUserSecurityRisks(user);
                identifiedRisks.addAll(userRisks);
                
                // 记录评估结果
                logSecurityAssessment(user.getId(), score, userRisks);
                
            } catch (Exception e) {
                log.error("Failed to assess security for user: " + user.getId(), e);
                identifiedRisks.add(createAssessmentError(user, e));
            }
        }
        
        report.setUserScores(userScores);
        report.setIdentifiedRisks(identifiedRisks);
        report.setAverageSecurityScore(calculateAverageScore(userScores));
        report.setHighRiskUsers(countHighRiskUsers(userScores));
        report.setCompletionDate(new Date());
        
        // 保存评估报告
        securityAssessmentRepository.save(report);
        
        // 发送评估报告
        sendSecurityAssessmentReport(report);
        
        return report;
    }
    
    private UserSecurityScore calculateUserSecurityScore(User user) {
        UserSecurityScore score = new UserSecurityScore();
        score.setUserId(user.getId());
        score.setAssessmentDate(new Date());
        
        int totalScore = 100;
        List<ScoreFactor> factors = new ArrayList<>();
        
        // 登录行为分析 (30分)
        LoginBehaviorScore loginScore = analyzeLoginBehavior(user);
        totalScore -= loginScore.getPenaltyPoints();
        factors.add(new ScoreFactor("Login Behavior", loginScore.getScore(), loginScore.getDetails()));
        
        // 密码安全检查 (25分)
        PasswordSecurityScore passwordScore = analyzePasswordSecurity(user);
        totalScore -= passwordScore.getPenaltyPoints();
        factors.add(new ScoreFactor("Password Security", passwordScore.getScore(), passwordScore.getDetails()));
        
        // 多因子认证状态 (20分)
        MfaSecurityScore mfaScore = analyzeMfaSecurity(user);
        totalScore -= mfaScore.getPenaltyPoints();
        factors.add(new ScoreFactor("MFA Status", mfaScore.getScore(), mfaScore.getDetails()));
        
        // 权限使用分析 (15分)
        PermissionUsageScore permissionScore = analyzePermissionUsage(user);
        totalScore -= permissionScore.getPenaltyPoints();
        factors.add(new ScoreFactor("Permission Usage", permissionScore.getScore(), permissionScore.getDetails()));
        
        // 安全培训完成情况 (10分)
        TrainingScore trainingScore = analyzeTrainingCompletion(user);
        totalScore -= trainingScore.getPenaltyPoints();
        factors.add(new ScoreFactor("Security Training", trainingScore.getScore(), trainingScore.getDetails()));
        
        score.setTotalScore(totalScore);
        score.setFactors(factors);
        score.setRiskLevel(determineRiskLevel(totalScore));
        
        return score;
    }
    
    private LoginBehaviorScore analyzeLoginBehavior(User user) {
        LoginBehaviorScore score = new LoginBehaviorScore();
        
        // 获取用户最近90天的登录记录
        List<LoginRecord> loginRecords = loginService.getUserLoginRecords(
            user.getId(), DateUtils.addDays(new Date(), -90), new Date());
        
        int penaltyPoints = 0;
        List<String> details = new ArrayList<>();
        
        // 检查异常登录时间
        long lateNightLogins = loginRecords.stream()
            .filter(record -> isLateNightLogin(record.getLoginTime()))
            .count();
        if (lateNightLogins > 10) {
            penaltyPoints += 5;
            details.add("Frequent late night logins: " + lateNightLogins);
        }
        
        // 检查异常登录地点
        long unusualLocationLogins = loginRecords.stream()
            .filter(record -> isUnusualLocation(record.getIpAddress()))
            .count();
        if (unusualLocationLogins > 3) {
            penaltyPoints += 10;
            details.add("Unusual location logins: " + unusualLocationLogins);
        }
        
        // 检查登录失败次数
        long failedLogins = loginRecords.stream()
            .filter(record -> !record.isSuccess())
            .count();
        if (failedLogins > 5) {
            penaltyPoints += 5;
            details.add("Multiple failed login attempts: " + failedLogins);
        }
        
        score.setPenaltyPoints(penaltyPoints);
        score.setScore(30 - penaltyPoints);
        score.setDetails(details);
        
        return score;
    }
}
```

## 离职阶段管理

### 离职流程启动

#### 离职申请处理

当收到员工离职申请时，启动相应的处理流程：

```java
public class OffboardingService {
    private UserService userService;
    private HrIntegrationService hrService;
    private AccessManagementService accessService;
    private AssetManagementService assetService;
    private NotificationService notificationService;
    
    public OffboardingProcess initiateOffboardingProcess(OffboardingRequest request) {
        OffboardingProcess process = new OffboardingProcess();
        process.setProcessId(generateProcessId());
        process.setEmployeeId(request.getEmployeeId());
        process.setOffboardingType(request.getOffboardingType());
        process.setLastWorkingDay(request.getLastWorkingDay());
        process.setInitiator(request.getInitiator());
        process.setInitiationDate(new Date());
        process.setStatus(OffboardingStatus.INITIATED);
        
        try {
            // 确认离职日期
            process.setConfirmedLastWorkingDay(confirmLastWorkingDay(request));
            
            // 通知相关部门
            notifyRelevantDepartments(process);
            
            // 准备离职检查清单
            prepareOffboardingChecklist(process);
            
            // 安排离职面谈
            scheduleExitInterview(process);
            
            // 更新流程状态
            process.setStatus(OffboardingStatus.IN_PROGRESS);
            
            // 保存流程信息
            offboardingProcessRepository.save(process);
            
            // 发送流程启动通知
            sendProcessInitiationNotification(process);
            
        } catch (Exception e) {
            log.error("Failed to initiate offboarding process for employee: " + request.getEmployeeId(), e);
            process.setStatus(OffboardingStatus.FAILED);
            process.setFailureReason(e.getMessage());
        }
        
        return process;
    }
    
    private void notifyRelevantDepartments(OffboardingProcess process) {
        // 通知IT部门
        notificationService.sendNotification(
            "IT_DEPARTMENT",
            "Offboarding initiated for employee: " + process.getEmployeeId(),
            "offboarding-initiated-template",
            createNotificationData(process)
        );
        
        // 通知HR部门
        notificationService.sendNotification(
            "HR_DEPARTMENT",
            "Offboarding initiated for employee: " + process.getEmployeeId(),
            "offboarding-initiated-template",
            createNotificationData(process)
        );
        
        // 通知直属经理
        User user = userService.getUserByEmployeeId(process.getEmployeeId());
        notificationService.sendNotification(
            user.getManagerId(),
            "Offboarding initiated for your team member: " + user.getFullName(),
            "offboarding-initiated-template",
            createNotificationData(process)
        );
    }
    
    private void prepareOffboardingChecklist(OffboardingProcess process) {
        OffboardingChecklist checklist = new OffboardingChecklist();
        checklist.setProcessId(process.getProcessId());
        checklist.setEmployeeId(process.getEmployeeId());
        
        // 添加IT相关检查项
        checklist.addItem(new ChecklistItem("Disable system access", ChecklistCategory.IT, ChecklistStatus.PENDING));
        checklist.addItem(new ChecklistItem("Revoke all permissions", ChecklistCategory.IT, ChecklistStatus.PENDING));
        checklist.addItem(new ChecklistItem("Collect company assets", ChecklistCategory.IT, ChecklistStatus.PENDING));
        
        // 添加HR相关检查项
        checklist.addItem(new ChecklistItem("Complete exit interview", ChecklistCategory.HR, ChecklistStatus.PENDING));
        checklist.addItem(new ChecklistItem("Return company property", ChecklistCategory.HR, ChecklistStatus.PENDING));
        checklist.addItem(new ChecklistItem("Process final paycheck", ChecklistCategory.HR, ChecklistStatus.PENDING));
        
        // 保存检查清单
        offboardingChecklistRepository.save(checklist);
    }
}
```

#### 权限冻结

在员工最后工作日，立即冻结其系统权限：

```java
public class PermissionFreezeService {
    private UserService userService;
    private AccessManagementService accessService;
    private RoleService roleService;
    private AuditService auditService;
    
    public void freezeUserPermissions(String employeeId, Date lastWorkingDay) {
        try {
            // 获取用户信息
            User user = userService.getUserByEmployeeId(employeeId);
            if (user == null) {
                throw new UserNotFoundException("User not found for employee ID: " + employeeId);
            }
            
            // 记录权限冻结操作
            logPermissionFreeze(user.getId(), lastWorkingDay);
            
            // 禁用系统登录
            disableSystemLogin(user.getId());
            
            // 冻结邮箱账户
            freezeEmailAccount(user.getId());
            
            // 撤销物理访问权限
            revokePhysicalAccess(user.getId());
            
            // 停止薪资发放
            notifyPayrollSystem(user.getId());
            
            // 发送权限冻结确认
            sendPermissionFreezeConfirmation(user, lastWorkingDay);
            
        } catch (Exception e) {
            log.error("Failed to freeze permissions for employee: " + employeeId, e);
            throw new PermissionFreezeException("Failed to freeze user permissions", e);
        }
    }
    
    private void disableSystemLogin(String userId) {
        // 禁用用户账户
        userService.disableUser(userId);
        
        // 记录审计日志
        auditService.logUserAction(
            userId, 
            "ACCOUNT_DISABLED", 
            "User account disabled due to offboarding", 
            new Date()
        );
        
        // 强制注销当前会话
        sessionService.terminateAllUserSessions(userId);
        
        // 撤销所有活跃的访问令牌
        tokenService.revokeAllUserTokens(userId);
    }
    
    private void freezeEmailAccount(String userId) {
        // 冻结邮箱账户
        emailService.freezeUserEmail(userId);
        
        // 设置自动回复
        emailService.setAutoReply(userId, "This employee has left the company. Please contact HR for further assistance.");
        
        // 转发重要邮件到指定人员
        User user = userService.getUserById(userId);
        emailService.setupEmailForwarding(userId, user.getManagerId());
        
        // 记录审计日志
        auditService.logUserAction(
            userId, 
            "EMAIL_FROZEN", 
            "User email account frozen due to offboarding", 
            new Date()
        );
    }
    
    private void revokePhysicalAccess(String userId) {
        // 撤销门禁卡权限
        accessControlService.revokeAccessCard(userId);
        
        // 撤销钥匙权限
        assetService.revokeKeyAccess(userId);
        
        // 记录审计日志
        auditService.logUserAction(
            userId, 
            "PHYSICAL_ACCESS_REVOKED", 
            "User physical access revoked due to offboarding", 
            new Date()
        );
    }
}
```

### 权限回收

#### 系统权限回收

全面回收员工在各系统中的权限：

```java
public class PermissionRevocationService {
    private UserService userService;
    private RoleService roleService;
    private AccessManagementService accessService;
    private SystemIntegrationService systemService;
    private AuditService auditService;
    
    public void revokeAllUserPermissions(String employeeId) {
        try {
            // 获取用户信息
            User user = userService.getUserByEmployeeId(employeeId);
            if (user == null) {
                throw new UserNotFoundException("User not found for employee ID: " + employeeId);
            }
            
            String userId = user.getId();
            
            // 记录权限回收开始
            logPermissionRevocationStart(userId);
            
            // 撤销业务系统访问权限
            revokeBusinessSystemPermissions(userId);
            
            // 删除特殊权限配置
            removeSpecialPermissionConfigurations(userId);
            
            // 清理临时权限
            cleanupTemporaryPermissions(userId);
            
            // 更新共享资源访问控制
            updateSharedResourceAccessControl(userId);
            
            // 通知相关系统权限变更
            notifySystemsOfPermissionChanges(userId);
            
            // 记录权限回收完成
            logPermissionRevocationComplete(userId);
            
            // 发送权限回收确认
            sendPermissionRevocationConfirmation(user);
            
        } catch (Exception e) {
            log.error("Failed to revoke permissions for employee: " + employeeId, e);
            throw new PermissionRevocationException("Failed to revoke user permissions", e);
        }
    }
    
    private void revokeBusinessSystemPermissions(String userId) {
        // 获取用户所有角色
        List<Role> userRoles = roleService.getUserRoles(userId);
        
        // 撤销所有角色
        for (Role role : userRoles) {
            roleService.revokeRoleFromUser(userId, role.getId());
            auditService.logPermissionRevocation(
                userId, 
                "ROLE_REVOCATION", 
                role.getId(), 
                "OFFBOARDING"
            );
        }
        
        // 获取用户所有系统访问权限
        List<SystemAccess> userAccesses = accessService.getUserSystemAccesses(userId);
        
        // 撤销所有系统访问权限
        for (SystemAccess access : userAccesses) {
            accessService.revokeSystemAccess(userId, access);
            auditService.logPermissionRevocation(
                userId, 
                "SYSTEM_ACCESS_REVOCATION", 
                access.getSystemId(), 
                "OFFBOARDING"
            );
        }
        
        // 通知各业务系统权限变更
        for (SystemAccess access : userAccesses) {
            try {
                systemService.notifySystemOfUserRemoval(
                    access.getSystemId(), 
                    userId, 
                    "User offboarding"
                );
            } catch (Exception e) {
                log.warn("Failed to notify system " + access.getSystemId() + " of user removal", e);
            }
        }
    }
    
    private void removeSpecialPermissionConfigurations(String userId) {
        // 删除特殊权限配置
        specialPermissionRepository.deleteByUserId(userId);
        
        // 删除审批权限配置
        approvalPermissionRepository.deleteByUserId(userId);
        
        // 删除数据访问权限配置
        dataAccessPermissionRepository.deleteByUserId(userId);
        
        // 删除API访问权限
        apiAccessPermissionRepository.deleteByUserId(userId);
    }
    
    private void cleanupTemporaryPermissions(String userId) {
        // 获取用户所有临时权限
        List<TemporaryPermission> tempPermissions = 
            temporaryPermissionRepository.findByUserId(userId);
        
        // 撤销所有临时权限
        for (TemporaryPermission tempPermission : tempPermissions) {
            tempPermission.setStatus(PermissionStatus.REVOKED);
            tempPermission.setRevocationDate(new Date());
            tempPermission.setRevocationReason("User offboarding");
            temporaryPermissionRepository.save(tempPermission);
            
            auditService.logPermissionRevocation(
                userId, 
                "TEMPORARY_PERMISSION_REVOCATION", 
                tempPermission.getId(), 
                "OFFBOARDING"
            );
        }
    }
}
```

#### 数据处理

处理员工相关的数据：

```java
public class DataHandlingService {
    private UserService userService;
    private DocumentManagementService documentService;
    private DataProtectionService dataProtectionService;
    private AuditService auditService;
    
    public void handleUserData(String employeeId, DataHandlingRequest request) {
        try {
            // 获取用户信息
            User user = userService.getUserByEmployeeId(employeeId);
            if (user == null) {
                throw new UserNotFoundException("User not found for employee ID: " + employeeId);
            }
            
            String userId = user.getId();
            
            // 备份重要工作数据
            backupImportantWorkData(userId, request);
            
            // 转移项目相关资料
            transferProjectRelatedDocuments(userId, request);
            
            // 删除个人数据（如符合法规要求）
            if (request.isDeletePersonalData()) {
                deletePersonalData(userId, request);
            }
            
            // 归档工作记录
            archiveWorkRecords(userId, request);
            
            // 记录数据处理操作
            logDataHandlingOperations(userId, request);
            
            // 发送数据处理确认
            sendDataHandlingConfirmation(user, request);
            
        } catch (Exception e) {
            log.error("Failed to handle user data for employee: " + employeeId, e);
            throw new DataHandlingException("Failed to handle user data", e);
        }
    }
    
    private void backupImportantWorkData(String userId, DataHandlingRequest request) {
        // 获取需要备份的重要数据
        List<Document> importantDocuments = 
            documentService.getImportantDocumentsForUser(userId);
        
        // 创建备份
        for (Document document : importantDocuments) {
            try {
                documentService.createBackup(document.getId(), request.getBackupLocation());
                auditService.logDataOperation(
                    userId, 
                    "DATA_BACKUP", 
                    "Document backed up: " + document.getName(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to backup document: " + document.getName(), e);
            }
        }
    }
    
    private void transferProjectRelatedDocuments(String userId, DataHandlingRequest request) {
        // 获取项目相关文档
        List<Document> projectDocuments = 
            documentService.getProjectDocumentsForUser(userId);
        
        // 转移文档所有权
        for (Document document : projectDocuments) {
            try {
                documentService.transferOwnership(
                    document.getId(), 
                    request.getTransferToUserId(), 
                    "User offboarding - project document transfer"
                );
                auditService.logDataOperation(
                    userId, 
                    "DOCUMENT_TRANSFER", 
                    "Document transferred: " + document.getName() + " to user: " + request.getTransferToUserId(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to transfer document: " + document.getName(), e);
            }
        }
    }
    
    private void deletePersonalData(String userId, DataHandlingRequest request) {
        // 验证删除权限
        if (!request.isAuthorizedToDeletePersonalData()) {
            throw new UnauthorizedOperationException("Not authorized to delete personal data");
        }
        
        // 获取用户个人数据
        List<PersonalData> personalDataList = 
            dataProtectionService.getPersonalDataForUser(userId);
        
        // 删除个人数据
        for (PersonalData personalData : personalDataList) {
            try {
                dataProtectionService.deletePersonalData(personalData.getId());
                auditService.logDataOperation(
                    userId, 
                    "PERSONAL_DATA_DELETION", 
                    "Personal data deleted: " + personalData.getDataType(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to delete personal data: " + personalData.getDataType(), e);
            }
        }
    }
}
```

#### 资产回收

回收公司提供的各类资产：

```java
public class AssetRecoveryService {
    private UserService userService;
    private AssetManagementService assetService;
    private AuditService auditService;
    private NotificationService notificationService;
    
    public void recoverCompanyAssets(String employeeId, AssetRecoveryRequest request) {
        try {
            // 获取用户信息
            User user = userService.getUserByEmployeeId(employeeId);
            if (user == null) {
                throw new UserNotFoundException("User not found for employee ID: " + employeeId);
            }
            
            String userId = user.getId();
            
            // 记录资产回收开始
            logAssetRecoveryStart(userId);
            
            // 回收办公设备
            List<Asset> recoveredAssets = recoverOfficeEquipment(userId, request);
            
            // 回收软件许可证
            List<SoftwareLicense> recoveredLicenses = recoverSoftwareLicenses(userId, request);
            
            // 回收门禁卡和钥匙
            recoverAccessCardsAndKeys(userId, request);
            
            // 回收公司文档和资料
            recoverCompanyDocuments(userId, request);
            
            // 更新资产状态
            updateAssetStatuses(recoveredAssets, recoveredLicenses);
            
            // 记录资产回收完成
            logAssetRecoveryComplete(userId, recoveredAssets, recoveredLicenses);
            
            // 发送资产回收确认
            sendAssetRecoveryConfirmation(user, recoveredAssets, recoveredLicenses);
            
        } catch (Exception e) {
            log.error("Failed to recover assets for employee: " + employeeId, e);
            throw new AssetRecoveryException("Failed to recover company assets", e);
        }
    }
    
    private List<Asset> recoverOfficeEquipment(String userId, AssetRecoveryRequest request) {
        List<Asset> assignedAssets = assetService.getAssignedAssetsForUser(userId);
        List<Asset> recoveredAssets = new ArrayList<>();
        
        for (Asset asset : assignedAssets) {
            try {
                // 检查资产状态
                if (assetService.isAssetInGoodCondition(asset.getId())) {
                    // 回收资产
                    assetService.recoverAsset(asset.getId(), userId, "User offboarding");
                    recoveredAssets.add(asset);
                    
                    auditService.logAssetOperation(
                        userId, 
                        "ASSET_RECOVERY", 
                        "Asset recovered: " + asset.getName() + " (" + asset.getAssetId() + ")", 
                        new Date()
                    );
                } else {
                    // 记录损坏资产
                    logDamagedAsset(asset, userId);
                    
                    // 如果需要，创建维修或赔偿请求
                    if (request.isReportDamages()) {
                        createDamageReport(asset, userId);
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to recover asset: " + asset.getName(), e);
            }
        }
        
        return recoveredAssets;
    }
    
    private List<SoftwareLicense> recoverSoftwareLicenses(String userId, AssetRecoveryRequest request) {
        List<SoftwareLicense> assignedLicenses = 
            assetService.getAssignedSoftwareLicensesForUser(userId);
        List<SoftwareLicense> recoveredLicenses = new ArrayList<>();
        
        for (SoftwareLicense license : assignedLicenses) {
            try {
                // 回收软件许可证
                assetService.recoverSoftwareLicense(license.getId(), userId, "User offboarding");
                recoveredLicenses.add(license);
                
                auditService.logAssetOperation(
                    userId, 
                    "LICENSE_RECOVERY", 
                    "Software license recovered: " + license.getSoftwareName(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to recover software license: " + license.getSoftwareName(), e);
            }
        }
        
        return recoveredLicenses;
    }
    
    private void recoverAccessCardsAndKeys(String userId, AssetRecoveryRequest request) {
        // 回收门禁卡
        List<AccessCard> accessCards = assetService.getUserAccessCards(userId);
        for (AccessCard card : accessCards) {
            try {
                assetService.recoverAccessCard(card.getId(), userId, "User offboarding");
                auditService.logAssetOperation(
                    userId, 
                    "ACCESS_CARD_RECOVERY", 
                    "Access card recovered: " + card.getCardNumber(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to recover access card: " + card.getCardNumber(), e);
            }
        }
        
        // 回收钥匙
        List<Key> keys = assetService.getUserKeys(userId);
        for (Key key : keys) {
            try {
                assetService.recoverKey(key.getId(), userId, "User offboarding");
                auditService.logAssetOperation(
                    userId, 
                    "KEY_RECOVERY", 
                    "Key recovered: " + key.getKeyNumber(), 
                    new Date()
                );
            } catch (Exception e) {
                log.warn("Failed to recover key: " + key.getKeyNumber(), e);
            }
        }
    }
}
```

## 自动化生命周期管理

### 工作流引擎

#### 流程定义

通过工作流引擎定义标准的生命周期管理流程：

```java
public class LifecycleWorkflowEngine {
    private WorkflowDefinitionService workflowService;
    private WorkflowExecutionService executionService;
    private NotificationService notificationService;
    
    public WorkflowDefinition createOnboardingWorkflow() {
        WorkflowDefinition workflow = new WorkflowDefinition();
        workflow.setWorkflowId("ONBOARDING_WORKFLOW");
        workflow.setName("Employee Onboarding Workflow");
        workflow.setDescription("Standard workflow for employee onboarding process");
        workflow.setVersion("1.0");
        
        // 定义流程步骤
        List<WorkflowStep> steps = new ArrayList<>();
        
        // 步骤1: 预入职准备
        WorkflowStep preOnboardingStep = new WorkflowStep();
        preOnboardingStep.setStepId("PRE_ONBOARDING");
        preOnboardingStep.setName("Pre-Onboarding Preparation");
        preOnboardingStep.setDescription("Prepare for employee onboarding");
        preOnboardingStep.setServiceClass(PreOnboardingService.class);
        preOnboardingStep.setMethodName("prepareOnboarding");
        preOnboardingStep.setOrder(1);
        steps.add(preOnboardingStep);
        
        // 步骤2: 身份验证
        WorkflowStep identityVerificationStep = new WorkflowStep();
        identityVerificationStep.setStepId("IDENTITY_VERIFICATION");
        identityVerificationStep.setName("Identity Verification");
        identityVerificationStep.setDescription("Verify employee identity");
        identityVerificationStep.setServiceClass(IdentityVerificationService.class);
        identityVerificationStep.setMethodName("verifyIdentity");
        identityVerificationStep.setOrder(2);
        steps.add(identityVerificationStep);
        
        // 步骤3: 账号创建
        WorkflowStep accountCreationStep = new WorkflowStep();
        accountCreationStep.setStepId("ACCOUNT_CREATION");
        accountCreationStep.setName("Account Creation");
        accountCreationStep.setDescription("Create employee account");
        accountCreationStep.setServiceClass(UserAccountService.class);
        accountCreationStep.setMethodName("createFormalUserAccount");
        accountCreationStep.setOrder(3);
        steps.add(accountCreationStep);
        
        // 步骤4: 权限授予
        WorkflowStep permissionAssignmentStep = new WorkflowStep();
        permissionAssignmentStep.setStepId("PERMISSION_ASSIGNMENT");
        permissionAssignmentStep.setName("Permission Assignment");
        permissionAssignmentStep.setDescription("Assign required permissions");
        permissionAssignmentStep.setServiceClass(PermissionAssignmentService.class);
        permissionAssignmentStep.setMethodName("assignPermissionsToNewUser");
        permissionAssignmentStep.setOrder(4);
        steps.add(permissionAssignmentStep);
        
        // 步骤5: 环境准备
        WorkflowStep environmentSetupStep = new WorkflowStep();
        environmentSetupStep.setStepId("ENVIRONMENT_SETUP");
        environmentSetupStep.setName("Environment Setup");
        environmentSetupStep.setDescription("Setup work environment");
        environmentSetupStep.setServiceClass(EnvironmentSetupService.class);
        environmentSetupStep.setMethodName("setupUserEnvironment");
        environmentSetupStep.setOrder(5);
        steps.add(environmentSetupStep);
        
        workflow.setSteps(steps);
        
        // 定义流程决策点
        List<WorkflowDecision> decisions = new ArrayList<>();
        
        // 身份验证决策点
        WorkflowDecision identityDecision = new WorkflowDecision();
        identityDecision.setDecisionId("IDENTITY_VERIFICATION_DECISION");
        identityDecision.setStepId("IDENTITY_VERIFICATION");
        identityDecision.setCondition("#{identityVerificationResult.overallVerified}");
        identityDecision.setTrueNextStep("ACCOUNT_CREATION");
        identityDecision.setFalseNextStep("IDENTITY_VERIFICATION_RETRY");
        decisions.add(identityDecision);
        
        workflow.setDecisions(decisions);
        
        // 保存工作流定义
        return workflowService.saveWorkflowDefinition(workflow);
    }
    
    public WorkflowExecution startOnboardingWorkflow(OnboardingData data) {
        // 创建工作流执行实例
        WorkflowExecution execution = new WorkflowExecution();
        execution.setExecutionId(generateExecutionId());
        execution.setWorkflowId("ONBOARDING_WORKFLOW");
        execution.setStartDate(new Date());
        execution.setStatus(WorkflowStatus.RUNNING);
        execution.setContextData(createContextData(data));
        
        // 启动工作流执行
        executionService.startWorkflowExecution(execution);
        
        return execution;
    }
}
```

#### 流程执行

自动化执行定义的流程：

```java
public class WorkflowExecutionService {
    private WorkflowDefinitionService workflowService;
    private TaskExecutionService taskService;
    private AuditService auditService;
    private NotificationService notificationService;
    
    public void startWorkflowExecution(WorkflowExecution execution) {
        try {
            // 记录工作流启动
            logWorkflowStart(execution);
            
            // 获取工作流定义
            WorkflowDefinition workflow = workflowService.getWorkflowDefinition(
                execution.getWorkflowId());
            
            // 按顺序执行工作流步骤
            for (WorkflowStep step : workflow.getSteps()) {
                // 检查是否需要执行该步骤
                if (shouldExecuteStep(execution, step)) {
                    // 执行步骤
                    executeWorkflowStep(execution, step);
                    
                    // 检查步骤执行结果
                    if (!isStepSuccessful(execution, step)) {
                        // 处理步骤失败
                        handleStepFailure(execution, step);
                        break;
                    }
                }
            }
            
            // 检查工作流是否完成
            if (isWorkflowComplete(execution, workflow)) {
                execution.setStatus(WorkflowStatus.COMPLETED);
                execution.setEndDate(new Date());
                
                // 发送工作流完成通知
                sendWorkflowCompletionNotification(execution);
            }
            
            // 更新工作流执行状态
            updateWorkflowExecution(execution);
            
        } catch (Exception e) {
            log.error("Failed to execute workflow: " + execution.getExecutionId(), e);
            execution.setStatus(WorkflowStatus.FAILED);
            execution.setEndDate(new Date());
            execution.setErrorMessage(e.getMessage());
            updateWorkflowExecution(execution);
        }
    }
    
    private void executeWorkflowStep(WorkflowExecution execution, WorkflowStep step) {
        try {
            // 记录步骤开始
            logStepStart(execution, step);
            
            // 创建任务执行记录
            TaskExecution taskExecution = new TaskExecution();
            taskExecution.setExecutionId(execution.getExecutionId());
            taskExecution.setStepId(step.getStepId());
            taskExecution.setStartTime(new Date());
            taskExecution.setStatus(TaskStatus.RUNNING);
            
            // 执行任务
            Object service = getServiceInstance(step.getServiceClass());
            Method method = getMethod(step.getServiceClass(), step.getMethodName());
            Object result = method.invoke(service, execution.getContextData());
            
            // 更新任务执行记录
            taskExecution.setEndTime(new Date());
            taskExecution.setStatus(TaskStatus.COMPLETED);
            taskExecution.setResult(result);
            
            // 保存任务执行记录
            taskService.saveTaskExecution(taskExecution);
            
            // 记录步骤完成
            logStepCompletion(execution, step, result);
            
        } catch (Exception e) {
            log.error("Failed to execute workflow step: " + step.getStepId(), e);
            
            // 记录步骤失败
            logStepFailure(execution, step, e);
            
            throw new WorkflowExecutionException("Failed to execute workflow step", e);
        }
    }
}
```

#### 流程监控

实时监控流程执行状态：

```java
public class WorkflowMonitoringService {
    private WorkflowExecutionService executionService;
    private AlertService alertService;
    private MetricsService metricsService;
    
    public void monitorWorkflowExecutions() {
        // 获取正在运行的工作流执行实例
        List<WorkflowExecution> runningExecutions = 
            executionService.getRunningExecutions();
        
        for (WorkflowExecution execution : runningExecutions) {
            try {
                // 监控执行进度
                monitorExecutionProgress(execution);
                
                // 检查超时情况
                checkExecutionTimeout(execution);
                
                // 监控资源使用情况
                monitorResourceUsage(execution);
                
                // 检查异常情况
                checkForAnomalies(execution);
                
            } catch (Exception e) {
                log.error("Failed to monitor workflow execution: " + execution.getExecutionId(), e);
            }
        }
    }
    
    private void monitorExecutionProgress(WorkflowExecution execution) {
        // 计算执行进度
        double progress = calculateExecutionProgress(execution);
        
        // 记录进度指标
        metricsService.recordWorkflowProgress(execution.getWorkflowId(), progress);
        
        // 检查进度是否正常
        if (progress < expectedProgress(execution)) {
            // 发送进度滞后警告
            alertService.sendAlert(
                AlertType.WORKFLOW_PROGRESS_LAG, 
                "Workflow execution is behind schedule: " + execution.getExecutionId(),
                createAlertData(execution, progress)
            );
        }
    }
    
    private void checkExecutionTimeout(WorkflowExecution execution) {
        // 获取工作流定义
        WorkflowDefinition workflow = workflowService.getWorkflowDefinition(
            execution.getWorkflowId());
        
        // 检查是否超时
        if (isExecutionTimedOut(execution, workflow.getTimeout())) {
            // 记录超时事件
            logExecutionTimeout(execution);
            
            // 发送超时警报
            alertService.sendAlert(
                AlertType.WORKFLOW_TIMEOUT, 
                "Workflow execution timed out: " + execution.getExecutionId(),
                createAlertData(execution)
            );
            
            // 尝试自动恢复
            attemptAutoRecovery(execution);
        }
    }
}
```

## 集成与同步

### HR系统集成

与HR系统深度集成，实现信息同步：

```java
public class HrIntegrationService {
    private HrSystemConnector hrConnector;
    private UserService userService;
    private PositionService positionService;
    private AuditService auditService;
    
    public void synchronizeHrData() {
        try {
            // 获取HR系统中的员工数据变更
            List<HrEmployeeData> changedEmployees = hrConnector.getChangedEmployees(
                getLastSyncTime());
            
            for (HrEmployeeData hrData : changedEmployees) {
                try {
                    // 同步员工基本信息
                    synchronizeEmployeeBasicInfo(hrData);
                    
                    // 同步组织架构信息
                    synchronizeOrganizationalInfo(hrData);
                    
                    // 同步岗位变动信息
                    synchronizePositionChanges(hrData);
                    
                    // 同步离职信息
                    synchronizeTerminationInfo(hrData);
                    
                    // 记录同步操作
                    logHrDataSynchronization(hrData);
                    
                } catch (Exception e) {
                    log.error("Failed to synchronize HR data for employee: " + 
                             hrData.getEmployeeId(), e);
                }
            }
            
            // 更新最后同步时间
            updateLastSyncTime(new Date());
            
        } catch (Exception e) {
            log.error("Failed to synchronize HR data", e);
            throw new HrIntegrationException("Failed to synchronize HR data", e);
        }
    }
    
    private void synchronizeEmployeeBasicInfo(HrEmployeeData hrData) {
        // 检查用户是否已存在
        User existingUser = userService.getUserByEmployeeId(hrData.getEmployeeId());
        
        if (existingUser == null) {
            // 创建新用户
            createUserFromHrData(hrData);
        } else {
            // 更新现有用户信息
            updateUserFromHrData(existingUser, hrData);
        }
    }
    
    private void synchronizePositionChanges(HrEmployeeData hrData) {
        // 检查是否有岗位变动
        if (hrData.hasPositionChanged()) {
            // 处理岗位变动
            handlePositionChangeFromHrData(hrData);
        }
    }
    
    private void handlePositionChangeFromHrData(HrEmployeeData hrData) {
        try {
            // 创建岗位变动请求
            PositionChangeRequest request = new PositionChangeRequest();
            request.setEmployeeId(hrData.getEmployeeId());
            request.setNewPosition(hrData.getPosition());
            request.setNewDepartment(hrData.getDepartment());
            request.setEffectiveDate(hrData.getPositionChangeDate());
            request.setReason("HR System Update");
            
            // 处理岗位变动
            positionChangeService.handlePositionChange(
                userService.getUserByEmployeeId(hrData.getEmployeeId()).getId(), 
                request
            );
            
            // 记录岗位变动同步
            auditService.logHrSynchronization(
                hrData.getEmployeeId(), 
                "POSITION_CHANGE", 
                "Position changed to: " + hrData.getPosition(), 
                new Date()
            );
            
        } catch (Exception e) {
            log.error("Failed to handle position change from HR data for employee: " + 
                     hrData.getEmployeeId(), e);
        }
    }
}
```

### 业务系统集成

与各业务系统集成，实现权限同步：

```java
public class BusinessSystemIntegrationService {
    private SystemIntegrationService integrationService;
    private PermissionService permissionService;
    private UserService userService;
    private AuditService auditService;
    
    public void synchronizePermissionsWithBusinessSystems() {
        try {
            // 获取所有业务系统
            List<BusinessSystem> businessSystems = integrationService.getAllBusinessSystems();
            
            for (BusinessSystem system : businessSystems) {
                try {
                    // 同步权限到业务系统
                    synchronizePermissionsToSystem(system);
                    
                } catch (Exception e) {
                    log.error("Failed to synchronize permissions to system: " + 
                             system.getSystemId(), e);
                }
            }
            
        } catch (Exception e) {
            log.error("Failed to synchronize permissions with business systems", e);
            throw new SystemIntegrationException("Failed to synchronize permissions", e);
        }
    }
    
    private void synchronizePermissionsToSystem(BusinessSystem system) {
        // 获取系统需要同步的用户权限
        List<UserPermission> permissionsToSync = 
            permissionService.getPermissionsToSyncForSystem(system.getSystemId());
        
        for (UserPermission permission : permissionsToSync) {
            try {
                // 同步权限到系统
                if (permission.isGranted()) {
                    integrationService.grantPermissionInSystem(
                        system.getSystemId(), 
                        permission.getUserId(), 
                        permission.getPermission()
                    );
                } else {
                    integrationService.revokePermissionInSystem(
                        system.getSystemId(), 
                        permission.getUserId(), 
                        permission.getPermission()
                    );
                }
                
                // 记录同步操作
                auditService.logPermissionSynchronization(
                    permission.getUserId(), 
                    system.getSystemId(), 
                    permission.getPermission(), 
                    permission.isGranted() ? "GRANTED" : "REVOKED", 
                    new Date()
                );
                
                // 更新同步状态
                permissionService.markPermissionAsSynced(
                    permission.getUserId(), 
                    system.getSystemId(), 
                    permission.getPermission()
                );
                
            } catch (Exception e) {
                log.error("Failed to synchronize permission to system: " + 
                         system.getSystemId() + " for user: " + permission.getUserId(), e);
                
                // 记录同步失败
                auditService.logPermissionSynchronization(
                    permission.getUserId(), 
                    system.getSystemId(), 
                    permission.getPermission(), 
                    "FAILED", 
                    new Date()
                );
            }
        }
    }
}
```

## 结论

用户生命周期管理是统一身份治理平台的核心功能，通过自动化流程和系统集成，可以显著提高管理效率并降低安全风险。从入职、在职到离职的完整生命周期管理，确保了用户在任何时候都拥有适当的访问权限。

在实施用户生命周期管理时，需要重点关注以下几个方面：

1. **自动化程度**：通过工作流引擎和系统集成，实现流程的自动化执行
2. **数据同步**：与HR系统和其他业务系统保持数据同步
3. **安全控制**：在每个阶段实施适当的安全控制措施
4. **合规性**：确保管理流程符合相关法规要求
5. **监控告警**：建立完善的监控和告警机制

通过合理设计和实施用户生命周期管理，企业可以构建一个安全、高效、合规的身份治理体系，为数字化转型提供坚实的基础支撑。