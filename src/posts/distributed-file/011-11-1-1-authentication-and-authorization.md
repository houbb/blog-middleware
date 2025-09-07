---
title: "认证与授权:RBAC、AK/SK、与公司统一认证集成"
date: 2025-09-07
categories: [DistributedFile]
tags: [DistributedFile]
published: true
---

在分布式文件存储平台中，认证（Authentication）和授权（Authorization）是确保数据安全的核心机制。认证解决"你是谁"的问题，而授权解决"你能做什么"的问题。一个完善的认证授权体系需要支持多种认证方式、灵活的权限控制模型，并能够与企业现有的身份管理系统集成。

## 11.1 认证机制设计

认证是验证用户身份的过程，确保用户是他们所声称的人。在分布式存储系统中，需要支持多种认证方式以满足不同场景的需求。

### 11.1.1 基于用户名密码的认证

```python
# 基于用户名密码的认证实现
import hashlib
import secrets
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

class PasswordAuthenticator:
    """密码认证器"""
    
    def __init__(self, min_password_length: int = 8):
        self.min_password_length = min_password_length
        self.users: Dict[str, Dict[str, Any]] = {}
        self.failed_attempts: Dict[str, List[datetime]] = {}
        self.lockout_threshold = 5
        self.lockout_duration = timedelta(minutes=30)
    
    def register_user(self, username: str, password: str, 
                     email: str = "", metadata: Dict[str, Any] = None) -> bool:
        """注册用户"""
        if username in self.users:
            print(f"用户 {username} 已存在")
            return False
        
        if len(password) < self.min_password_length:
            print(f"密码长度不能少于 {self.min_password_length} 位")
            return False
        
        # 生成盐值和哈希
        salt = secrets.token_hex(16)
        password_hash = self._hash_password(password, salt)
        
        self.users[username] = {
            "username": username,
            "password_hash": password_hash,
            "salt": salt,
            "email": email,
            "created_at": datetime.now(),
            "last_login": None,
            "is_locked": False,
            "locked_until": None,
            "metadata": metadata or {}
        }
        
        print(f"用户 {username} 注册成功")
        return True
    
    def _hash_password(self, password: str, salt: str) -> str:
        """哈希密码"""
        # 使用PBKDF2进行密码哈希（简化实现）
        combined = (password + salt).encode('utf-8')
        return hashlib.sha256(combined).hexdigest()
    
    def authenticate(self, username: str, password: str) -> Dict[str, Any]:
        """认证用户"""
        # 检查用户是否存在
        if username not in self.users:
            self._record_failed_attempt(username)
            return {"success": False, "error": "用户不存在"}
        
        user = self.users[username]
        
        # 检查账户是否被锁定
        if user["is_locked"]:
            if user["locked_until"] and datetime.now() < user["locked_until"]:
                return {"success": False, "error": "账户已被锁定"}
            else:
                # 解锁账户
                user["is_locked"] = False
                user["locked_until"] = None
        
        # 验证密码
        password_hash = self._hash_password(password, user["salt"])
        if password_hash == user["password_hash"]:
            # 认证成功
            user["last_login"] = datetime.now()
            self._clear_failed_attempts(username)
            return {
                "success": True,
                "user_id": username,
                "user_info": {
                    "username": user["username"],
                    "email": user["email"],
                    "created_at": user["created_at"]
                }
            }
        else:
            # 认证失败
            self._record_failed_attempt(username)
            return {"success": False, "error": "密码错误"}
    
    def _record_failed_attempt(self, username: str):
        """记录失败尝试"""
        if username not in self.failed_attempts:
            self.failed_attempts[username] = []
        
        now = datetime.now()
        self.failed_attempts[username].append(now)
        
        # 清理过期的失败记录
        cutoff_time = now - self.lockout_duration
        self.failed_attempts[username] = [
            attempt for attempt in self.failed_attempts[username]
            if attempt >= cutoff_time
        ]
        
        # 检查是否需要锁定账户
        if len(self.failed_attempts[username]) >= self.lockout_threshold:
            if username in self.users:
                self.users[username]["is_locked"] = True
                self.users[username]["locked_until"] = now + self.lockout_duration
                print(f"用户 {username} 账户已被锁定，解锁时间: {self.users[username]['locked_until']}")
    
    def _clear_failed_attempts(self, username: str):
        """清除失败尝试记录"""
        if username in self.failed_attempts:
            del self.failed_attempts[username]
    
    def change_password(self, username: str, old_password: str, 
                       new_password: str) -> bool:
        """修改密码"""
        auth_result = self.authenticate(username, old_password)
        if not auth_result["success"]:
            print("原密码验证失败")
            return False
        
        if len(new_password) < self.min_password_length:
            print(f"新密码长度不能少于 {self.min_password_length} 位")
            return False
        
        # 更新密码
        user = self.users[username]
        new_salt = secrets.token_hex(16)
        new_hash = self._hash_password(new_password, new_salt)
        
        user["salt"] = new_salt
        user["password_hash"] = new_hash
        
        print(f"用户 {username} 密码修改成功")
        return True
    
    def reset_password(self, username: str, new_password: str) -> bool:
        """重置密码（管理员操作）"""
        if username not in self.users:
            print(f"用户 {username} 不存在")
            return False
        
        if len(new_password) < self.min_password_length:
            print(f"密码长度不能少于 {self.min_password_length} 位")
            return False
        
        # 更新密码
        user = self.users[username]
        new_salt = secrets.token_hex(16)
        new_hash = self._hash_password(new_password, new_salt)
        
        user["salt"] = new_salt
        user["password_hash"] = new_hash
        user["is_locked"] = False
        user["locked_until"] = None
        
        print(f"用户 {username} 密码重置成功")
        return True
    
    def get_user_info(self, username: str) -> Dict[str, Any]:
        """获取用户信息"""
        if username not in self.users:
            return {"error": "用户不存在"}
        
        user = self.users[username]
        return {
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
            "is_locked": user["is_locked"],
            "locked_until": user["locked_until"]
        }

# 使用示例
def demonstrate_password_authentication():
    """演示密码认证"""
    # 创建认证器
    authenticator = PasswordAuthenticator(min_password_length=6)
    
    # 注册用户
    print("注册用户...")
    authenticator.register_user("alice", "password123", "alice@example.com", {"department": "engineering"})
    authenticator.register_user("bob", "secret456", "bob@example.com", {"department": "marketing"})
    authenticator.register_user("charlie", "weak", "charlie@example.com")  # 密码太短，注册失败
    
    # 认证用户
    print("\n认证用户...")
    result1 = authenticator.authenticate("alice", "password123")
    print(f"Alice认证结果: {result1['success']}")
    
    result2 = authenticator.authenticate("bob", "wrongpassword")
    print(f"Bob认证结果: {result2['success']} - {result2['error']}")
    
    # 多次失败尝试导致账户锁定
    print("\n模拟多次失败尝试...")
    for i in range(6):
        result = authenticator.authenticate("bob", "wrongpassword")
        print(f"尝试 {i+1}: {result['error']}")
    
    # 尝试认证被锁定的账户
    result = authenticator.authenticate("bob", "secret456")
    print(f"被锁定账户认证: {result['error']}")
    
    # 修改密码
    print("\n修改密码...")
    success = authenticator.change_password("alice", "password123", "newpassword123")
    print(f"密码修改结果: {success}")
    
    # 使用新密码认证
    result = authenticator.authenticate("alice", "newpassword123")
    print(f"新密码认证结果: {result['success']}")
    
    # 重置密码
    print("\n重置密码...")
    success = authenticator.reset_password("bob", "resetpassword123")
    print(f"密码重置结果: {success}")
    
    # 使用重置后的密码认证
    result = authenticator.authenticate("bob", "resetpassword123")
    print(f"重置密码认证结果: {result['success']}")
    
    # 显示用户信息
    print("\n用户信息:")
    alice_info = authenticator.get_user_info("alice")
    print(f"Alice信息: {alice_info}")
    bob_info = authenticator.get_user_info("bob")
    print(f"Bob信息: {bob_info}")

# 运行演示
# demonstrate_password_authentication()
```

### 11.1.2 基于Token的认证

```python
# 基于Token的认证实现
import jwt
import secrets
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

class TokenAuthenticator:
    """Token认证器"""
    
    def __init__(self, secret_key: str = None, token_expiry_hours: int = 24):
        self.secret_key = secret_key or secrets.token_urlsafe(32)
        self.token_expiry_hours = token_expiry_hours
        self.refresh_tokens: Dict[str, Dict[str, Any]] = {}
        self.blacklisted_tokens: set = set()
    
    def generate_access_token(self, user_id: str, permissions: List[str] = None,
                            metadata: Dict[str, Any] = None) -> str:
        """生成访问令牌"""
        payload = {
            "user_id": user_id,
            "permissions": permissions or [],
            "metadata": metadata or {},
            "exp": datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
            "iat": datetime.utcnow(),
            "token_type": "access"
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm="HS256")
        return token
    
    def generate_refresh_token(self, user_id: str) -> str:
        """生成刷新令牌"""
        refresh_token = secrets.token_urlsafe(32)
        
        self.refresh_tokens[refresh_token] = {
            "user_id": user_id,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(days=30),  # 刷新令牌有效期30天
            "used": False
        }
        
        return refresh_token
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """验证令牌"""
        # 检查是否在黑名单中
        if token in self.blacklisted_tokens:
            return {"success": False, "error": "令牌已失效"}
        
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            
            # 检查令牌类型
            if payload.get("token_type") != "access":
                return {"success": False, "error": "无效的令牌类型"}
            
            return {
                "success": True,
                "user_id": payload["user_id"],
                "permissions": payload["permissions"],
                "metadata": payload["metadata"],
                "exp": payload["exp"]
            }
        except jwt.ExpiredSignatureError:
            return {"success": False, "error": "令牌已过期"}
        except jwt.InvalidTokenError:
            return {"success": False, "error": "无效的令牌"}
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """刷新访问令牌"""
        # 检查刷新令牌是否存在
        if refresh_token not in self.refresh_tokens:
            return {"success": False, "error": "无效的刷新令牌"}
        
        token_info = self.refresh_tokens[refresh_token]
        
        # 检查刷新令牌是否过期
        if datetime.now() > token_info["expires_at"]:
            del self.refresh_tokens[refresh_token]
            return {"success": False, "error": "刷新令牌已过期"}
        
        # 检查刷新令牌是否已被使用
        if token_info["used"]:
            # 安全措施：删除所有相关的令牌
            del self.refresh_tokens[refresh_token]
            return {"success": False, "error": "刷新令牌已被使用"}
        
        # 标记刷新令牌为已使用
        token_info["used"] = True
        
        # 生成新的访问令牌和刷新令牌
        new_access_token = self.generate_access_token(
            token_info["user_id"],
            metadata=token_info.get("metadata", {})
        )
        new_refresh_token = self.generate_refresh_token(token_info["user_id"])
        
        return {
            "success": True,
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "user_id": token_info["user_id"]
        }
    
    def invalidate_token(self, token: str) -> bool:
        """使令牌失效"""
        try:
            # 验证令牌以获取payload
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            
            # 将令牌加入黑名单
            self.blacklisted_tokens.add(token)
            return True
        except jwt.InvalidTokenError:
            return False
    
    def invalidate_refresh_token(self, refresh_token: str) -> bool:
        """使刷新令牌失效"""
        if refresh_token in self.refresh_tokens:
            del self.refresh_tokens[refresh_token]
            return True
        return False
    
    def cleanup_expired_tokens(self):
        """清理过期的刷新令牌"""
        current_time = datetime.now()
        expired_tokens = [
            token for token, info in self.refresh_tokens.items()
            if current_time > info["expires_at"]
        ]
        
        for token in expired_tokens:
            del self.refresh_tokens[token]
        
        return len(expired_tokens)

class TokenBasedAuthService:
    """基于Token的认证服务"""
    
    def __init__(self, token_authenticator: TokenAuthenticator):
        self.token_auth = token_authenticator
        self.user_sessions: Dict[str, List[str]] = {}  # user_id -> [active_tokens]
    
    def login(self, user_id: str, permissions: List[str] = None,
             metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """用户登录"""
        # 生成访问令牌和刷新令牌
        access_token = self.token_auth.generate_access_token(user_id, permissions, metadata)
        refresh_token = self.token_auth.generate_refresh_token(user_id)
        
        # 记录用户会话
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = []
        self.user_sessions[user_id].append(access_token)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": self.token_auth.token_expiry_hours * 3600
        }
    
    def logout(self, access_token: str) -> bool:
        """用户登出"""
        # 使访问令牌失效
        self.token_auth.invalidate_token(access_token)
        
        # 从用户会话中移除
        try:
            payload = jwt.decode(access_token, self.token_auth.secret_key, algorithms=["HS256"])
            user_id = payload["user_id"]
            if user_id in self.user_sessions:
                if access_token in self.user_sessions[user_id]:
                    self.user_sessions[user_id].remove(access_token)
        except jwt.InvalidTokenError:
            pass
        
        return True
    
    def verify_request(self, token: str) -> Dict[str, Any]:
        """验证请求令牌"""
        return self.token_auth.validate_token(token)
    
    def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        """刷新会话"""
        result = self.token_auth.refresh_access_token(refresh_token)
        if result["success"]:
            # 更新用户会话
            user_id = result["user_id"]
            new_token = result["access_token"]
            
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = []
            self.user_sessions[user_id].append(new_token)
        
        return result
    
    def get_user_sessions(self, user_id: str) -> List[str]:
        """获取用户活动会话"""
        return self.user_sessions.get(user_id, []).copy()

# 使用示例
def demonstrate_token_authentication():
    """演示Token认证"""
    # 创建Token认证器
    token_auth = TokenAuthenticator(token_expiry_hours=1)  # 1小时过期
    auth_service = TokenBasedAuthService(token_auth)
    
    # 用户登录
    print("用户登录...")
    login_result = auth_service.login(
        "alice",
        permissions=["read", "write", "delete"],
        metadata={"department": "engineering", "role": "developer"}
    )
    print(f"登录结果: {login_result['success'] if 'success' in login_result else True}")
    print(f"访问令牌: {login_result['access_token'][:20]}...")
    print(f"刷新令牌: {login_result['refresh_token'][:20]}...")
    
    access_token = login_result["access_token"]
    refresh_token = login_result["refresh_token"]
    
    # 验证令牌
    print("\n验证令牌...")
    verify_result = auth_service.verify_request(access_token)
    print(f"验证结果: {verify_result['success']}")
    if verify_result["success"]:
        print(f"用户ID: {verify_result['user_id']}")
        print(f"权限: {verify_result['permissions']}")
        print(f"元数据: {verify_result['metadata']}")
    
    # 用户登出
    print("\n用户登出...")
    logout_result = auth_service.logout(access_token)
    print(f"登出结果: {logout_result}")
    
    # 验证已失效的令牌
    print("\n验证已失效的令牌...")
    verify_result = auth_service.verify_request(access_token)
    print(f"验证结果: {verify_result['success']} - {verify_result['error']}")
    
    # 使用刷新令牌获取新令牌
    print("\n使用刷新令牌...")
    refresh_result = auth_service.refresh_session(refresh_token)
    print(f"刷新结果: {refresh_result['success']}")
    if refresh_result["success"]:
        new_access_token = refresh_result["access_token"]
        print(f"新访问令牌: {new_access_token[:20]}...")
        
        # 验证新令牌
        verify_result = auth_service.verify_request(new_access_token)
        print(f"新令牌验证: {verify_result['success']}")
    
    # 查看用户会话
    print("\n用户会话:")
    sessions = auth_service.get_user_sessions("alice")
    print(f"Alice的活动会话数: {len(sessions)}")
    
    # 清理过期令牌
    print("\n清理过期令牌...")
    cleaned_count = token_auth.cleanup_expired_tokens()
    print(f"清理了 {cleaned_count} 个过期令牌")

# 运行演示
# demonstrate_token_authentication()
```

## 11.2 授权机制设计

授权是确定经过认证的用户可以访问哪些资源和执行哪些操作的过程。在分布式存储系统中，需要实现灵活且安全的授权机制。

### 11.2.1 基于角色的访问控制（RBAC）

```python
# 基于角色的访问控制（RBAC）实现
from typing import Dict, List, Set, Any, Optional
from datetime import datetime
import json

class Role:
    """角色"""
    
    def __init__(self, role_id: str, name: str, description: str):
        self.role_id = role_id
        self.name = name
        self.description = description
        self.permissions: Set[str] = set()
        self.created_at = datetime.now()
    
    def add_permission(self, permission: str):
        """添加权限"""
        self.permissions.add(permission)
    
    def remove_permission(self, permission: str):
        """移除权限"""
        self.permissions.discard(permission)
    
    def has_permission(self, permission: str) -> bool:
        """检查是否具有权限"""
        return permission in self.permissions

class User:
    """用户"""
    
    def __init__(self, user_id: str, username: str, email: str = ""):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.roles: Set[str] = set()  # 角色ID集合
        self.direct_permissions: Set[str] = set()  # 直接分配的权限
        self.created_at = datetime.now()
        self.is_active = True
    
    def add_role(self, role_id: str):
        """添加角色"""
        self.roles.add(role_id)
    
    def remove_role(self, role_id: str):
        """移除角色"""
        self.roles.discard(role_id)
    
    def add_permission(self, permission: str):
        """添加直接权限"""
        self.direct_permissions.add(permission)
    
    def remove_permission(self, permission: str):
        """移除直接权限"""
        self.direct_permissions.discard(permission)

class RBACManager:
    """RBAC管理器"""
    
    def __init__(self):
        self.roles: Dict[str, Role] = {}
        self.users: Dict[str, User] = {}
        self.role_hierarchy: Dict[str, List[str]] = {}  # role_id -> [child_role_ids]
        self.resource_permissions: Dict[str, Set[str]] = {}  # resource -> {permissions}
    
    def create_role(self, role_id: str, name: str, description: str = "") -> bool:
        """创建角色"""
        if role_id in self.roles:
            print(f"角色 {role_id} 已存在")
            return False
        
        self.roles[role_id] = Role(role_id, name, description)
        print(f"角色 {name} ({role_id}) 创建成功")
        return True
    
    def delete_role(self, role_id: str) -> bool:
        """删除角色"""
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        # 从所有用户中移除该角色
        for user in self.users.values():
            user.remove_role(role_id)
        
        # 从角色层次结构中移除
        if role_id in self.role_hierarchy:
            del self.role_hierarchy[role_id]
        
        # 移除子角色的父角色引用
        for parent_role_id, child_roles in self.role_hierarchy.items():
            if role_id in child_roles:
                child_roles.remove(role_id)
        
        del self.roles[role_id]
        print(f"角色 {role_id} 删除成功")
        return True
    
    def add_permission_to_role(self, role_id: str, permission: str) -> bool:
        """为角色添加权限"""
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        self.roles[role_id].add_permission(permission)
        print(f"权限 {permission} 已添加到角色 {role_id}")
        return True
    
    def remove_permission_from_role(self, role_id: str, permission: str) -> bool:
        """从角色移除权限"""
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        self.roles[role_id].remove_permission(permission)
        print(f"权限 {permission} 已从角色 {role_id} 移除")
        return True
    
    def create_user(self, user_id: str, username: str, email: str = "") -> bool:
        """创建用户"""
        if user_id in self.users:
            print(f"用户 {user_id} 已存在")
            return False
        
        self.users[user_id] = User(user_id, username, email)
        print(f"用户 {username} ({user_id}) 创建成功")
        return True
    
    def delete_user(self, user_id: str) -> bool:
        """删除用户"""
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        del self.users[user_id]
        print(f"用户 {user_id} 删除成功")
        return True
    
    def assign_role_to_user(self, user_id: str, role_id: str) -> bool:
        """为用户分配角色"""
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        if role_id not in self.roles:
            print(f"角色 {role_id} 不存在")
            return False
        
        self.users[user_id].add_role(role_id)
        print(f"角色 {role_id} 已分配给用户 {user_id}")
        return True
    
    def remove_role_from_user(self, user_id: str, role_id: str) -> bool:
        """从用户移除角色"""
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        self.users[user_id].remove_role(role_id)
        print(f"角色 {role_id} 已从用户 {user_id} 移除")
        return True
    
    def add_direct_permission_to_user(self, user_id: str, permission: str) -> bool:
        """为用户添加直接权限"""
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        self.users[user_id].add_permission(permission)
        print(f"直接权限 {permission} 已添加给用户 {user_id}")
        return True
    
    def remove_direct_permission_from_user(self, user_id: str, permission: str) -> bool:
        """从用户移除直接权限"""
        if user_id not in self.users:
            print(f"用户 {user_id} 不存在")
            return False
        
        self.users[user_id].remove_permission(permission)
        print(f"直接权限 {permission} 已从用户 {user_id} 移除")
        return True
    
    def set_role_hierarchy(self, parent_role_id: str, child_role_id: str) -> bool:
        """设置角色层次结构"""
        if parent_role_id not in self.roles:
            print(f"父角色 {parent_role_id} 不存在")
            return False
        
        if child_role_id not in self.roles:
            print(f"子角色 {child_role_id} 不存在")
            return False
        
        if parent_role_id not in self.role_hierarchy:
            self.role_hierarchy[parent_role_id] = []
        
        if child_role_id not in self.role_hierarchy[parent_role_id]:
            self.role_hierarchy[parent_role_id].append(child_role_id)
            print(f"设置角色层次: {parent_role_id} -> {child_role_id}")
        
        return True
    
    def get_user_permissions(self, user_id: str) -> Set[str]:
        """获取用户的所有权限"""
        if user_id not in self.users:
            return set()
        
        user = self.users[user_id]
        permissions = set(user.direct_permissions)
        
        # 获取用户角色的权限
        for role_id in user.roles:
            if role_id in self.roles:
                permissions.update(self.roles[role_id].permissions)
        
        # 获取继承角色的权限
        for role_id in user.roles:
            inherited_permissions = self._get_inherited_permissions(role_id)
            permissions.update(inherited_permissions)
        
        return permissions
    
    def _get_inherited_permissions(self, role_id: str) -> Set[str]:
        """获取继承的权限"""
        permissions = set()
        
        # 获取直接子角色
        child_roles = self.role_hierarchy.get(role_id, [])
        for child_role_id in child_roles:
            if child_role_id in self.roles:
                permissions.update(self.roles[child_role_id].permissions)
                # 递归获取子角色的继承权限
                permissions.update(self._get_inherited_permissions(child_role_id))
        
        return permissions
    
    def check_user_permission(self, user_id: str, permission: str) -> bool:
        """检查用户是否具有指定权限"""
        if user_id not in self.users:
            return False
        
        user = self.users[user_id]
        
        # 检查直接权限
        if permission in user.direct_permissions:
            return True
        
        # 检查角色权限
        user_permissions = self.get_user_permissions(user_id)
        return permission in user_permissions
    
    def get_user_roles(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的角色信息"""
        if user_id not in self.users:
            return []
        
        user = self.users[user_id]
        roles_info = []
        
        for role_id in user.roles:
            if role_id in self.roles:
                role = self.roles[role_id]
                roles_info.append({
                    "role_id": role.role_id,
                    "name": role.name,
                    "description": role.description,
                    "permissions": list(role.permissions)
                })
        
        return roles_info
    
    def get_role_users(self, role_id: str) -> List[str]:
        """获取具有指定角色的用户列表"""
        if role_id not in self.roles:
            return []
        
        users_with_role = []
        for user_id, user in self.users.items():
            if role_id in user.roles:
                users_with_role.append(user_id)
        
        return users_with_role

# 使用示例
def demonstrate_rbac():
    """演示RBAC"""
    # 创建RBAC管理器
    rbac = RBACManager()
    
    # 创建角色
    print("创建角色...")
    rbac.create_role("admin", "系统管理员", "具有系统完全访问权限")
    rbac.create_role("developer", "开发者", "具有开发相关权限")
    rbac.create_role("viewer", "查看者", "只能查看数据")
    rbac.create_role("operator", "操作员", "可以执行基本操作")
    
    # 为角色分配权限
    print("\n为角色分配权限...")
    # 管理员权限
    admin_permissions = ["user:create", "user:delete", "user:update", "user:view", 
                        "data:create", "data:delete", "data:update", "data:view",
                        "system:configure", "system:monitor"]
    for perm in admin_permissions:
        rbac.add_permission_to_role("admin", perm)
    
    # 开发者权限
    dev_permissions = ["data:create", "data:update", "data:view", "code:deploy"]
    for perm in dev_permissions:
        rbac.add_permission_to_role("developer", perm)
    
    # 查看者权限
    viewer_permissions = ["data:view"]
    for perm in viewer_permissions:
        rbac.add_permission_to_role("viewer", perm)
    
    # 操作员权限
    operator_permissions = ["data:view", "data:update"]
    for perm in operator_permissions:
        rbac.add_permission_to_role("operator", perm)
    
    # 设置角色层次结构
    print("\n设置角色层次结构...")
    rbac.set_role_hierarchy("admin", "developer")
    rbac.set_role_hierarchy("admin", "operator")
    rbac.set_role_hierarchy("operator", "viewer")
    
    # 创建用户
    print("\n创建用户...")
    rbac.create_user("user-001", "Alice", "alice@example.com")
    rbac.create_user("user-002", "Bob", "bob@example.com")
    rbac.create_user("user-003", "Charlie", "charlie@example.com")
    rbac.create_user("user-004", "David", "david@example.com")
    
    # 为用户分配角色
    print("\n为用户分配角色...")
    rbac.assign_role_to_user("user-001", "admin")
    rbac.assign_role_to_user("user-002", "developer")
    rbac.assign_role_to_user("user-003", "operator")
    rbac.assign_role_to_user("user-004", "viewer")
    
    # 为用户添加直接权限
    print("\n为用户添加直接权限...")
    rbac.add_direct_permission_to_user("user-002", "special:feature")
    
    # 检查用户权限
    print("\n检查用户权限...")
    test_users = ["user-001", "user-002", "user-003", "user-004"]
    test_permissions = ["user:create", "data:view", "data:delete", "special:feature"]
    
    for user_id in test_users:
        print(f"\n用户 {user_id} 的权限检查:")
        user = rbac.users[user_id]
        print(f"  用户名: {user.username}")
        print(f"  角色: {list(user.roles)}")
        
        for perm in test_permissions:
            has_permission = rbac.check_user_permission(user_id, perm)
            print(f"    {perm}: {'允许' if has_permission else '拒绝'}")
    
    # 获取用户详细信息
    print("\n用户详细信息:")
    for user_id in test_users:
        user = rbac.users[user_id]
        permissions = rbac.get_user_permissions(user_id)
        roles = rbac.get_user_roles(user_id)
        
        print(f"\n用户 {user.username} ({user_id}):")
        print(f"  直接权限: {list(user.direct_permissions)}")
        print(f"  所有权限: {list(permissions)[:10]}{'...' if len(permissions) > 10 else ''}")
        print(f"  角色数量: {len(roles)}")
        for role in roles:
            print(f"    - {role['name']}: {role['description']}")

# 运行演示
# demonstrate_rbac()
```

### 11.2.2 基于密钥的认证（AK/SK）

```python
# 基于密钥的认证（AK/SK）实现
import hashlib
import hmac
import time
import secrets
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

class AccessKey:
    """访问密钥"""
    
    def __init__(self, access_key_id: str, secret_access_key: str, 
                 user_id: str, description: str = ""):
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.user_id = user_id
        self.description = description
        self.created_at = datetime.now()
        self.last_used_at: Optional[datetime] = None
        self.is_active = True
        self.permissions: List[str] = []
        self.expiration_date: Optional[datetime] = None

class AKSKAuthenticator:
    """AK/SK认证器"""
    
    def __init__(self):
        self.access_keys: Dict[str, AccessKey] = {}
        self.user_keys: Dict[str, List[str]] = {}  # user_id -> [access_key_ids]
    
    def generate_access_key_pair(self, user_id: str, description: str = "",
                               expiration_days: Optional[int] = None) -> Dict[str, str]:
        """生成访问密钥对"""
        # 生成访问密钥ID（类似AWS的AKID）
        access_key_id = "AK" + secrets.token_urlsafe(16).replace("-", "").replace("_", "")[:18].upper()
        
        # 生成秘密访问密钥
        secret_access_key = secrets.token_urlsafe(32)
        
        # 设置过期时间
        expiration_date = None
        if expiration_days:
            expiration_date = datetime.now() + timedelta(days=expiration_days)
        
        # 创建访问密钥对象
        access_key = AccessKey(access_key_id, secret_access_key, user_id, description)
        access_key.expiration_date = expiration_date
        
        # 存储访问密钥
        self.access_keys[access_key_id] = access_key
        
        # 更新用户密钥列表
        if user_id not in self.user_keys:
            self.user_keys[user_id] = []
        self.user_keys[user_id].append(access_key_id)
        
        print(f"为用户 {user_id} 生成访问密钥对: {access_key_id}")
        
        return {
            "access_key_id": access_key_id,
            "secret_access_key": secret_access_key
        }
    
    def delete_access_key(self, access_key_id: str) -> bool:
        """删除访问密钥"""
        if access_key_id not in self.access_keys:
            print(f"访问密钥 {access_key_id} 不存在")
            return False
        
        access_key = self.access_keys[access_key_id]
        user_id = access_key.user_id
        
        # 从存储中删除
        del self.access_keys[access_key_id]
        
        # 从用户密钥列表中移除
        if user_id in self.user_keys:
            if access_key_id in self.user_keys[user_id]:
                self.user_keys[user_id].remove(access_key_id)
        
        print(f"访问密钥 {access_key_id} 已删除")
        return True
    
    def deactivate_access_key(self, access_key_id: str) -> bool:
        """停用访问密钥"""
        if access_key_id not in self.access_keys:
            print(f"访问密钥 {access_key_id} 不存在")
            return False
        
        self.access_keys[access_key_id].is_active = False
        print(f"访问密钥 {access_key_id} 已停用")
        return True
    
    def activate_access_key(self, access_key_id: str) -> bool:
        """激活访问密钥"""
        if access_key_id not in self.access_keys:
            print(f"访问密钥 {access_key_id} 不存在")
            return False
        
        self.access_keys[access_key_id].is_active = True
        print(f"访问密钥 {access_key_id} 已激活")
        return True
    
    def add_permissions_to_key(self, access_key_id: str, permissions: List[str]) -> bool:
        """为密钥添加权限"""
        if access_key_id not in self.access_keys:
            print(f"访问密钥 {access_key_id} 不存在")
            return False
        
        access_key = self.access_keys[access_key_id]
        access_key.permissions.extend(permissions)
        print(f"为密钥 {access_key_id} 添加权限: {permissions}")
        return True
    
    def authenticate_request(self, access_key_id: str, signature: str,
                           request_data: Dict[str, Any], timestamp: int) -> Dict[str, Any]:
        """认证请求"""
        # 检查访问密钥是否存在
        if access_key_id not in self.access_keys:
            return {"success": False, "error": "无效的访问密钥ID"}
        
        access_key = self.access_keys[access_key_id]
        
        # 检查密钥是否激活
        if not access_key.is_active:
            return {"success": False, "error": "访问密钥已被停用"}
        
        # 检查是否过期
        if access_key.expiration_date and datetime.now() > access_key.expiration_date:
            return {"success": False, "error": "访问密钥已过期"}
        
        # 验证时间戳（通常允许15分钟的时间偏差）
        current_timestamp = int(time.time())
        time_diff = abs(current_timestamp - timestamp)
        if time_diff > 900:  # 15分钟
            return {"success": False, "error": "请求时间戳超出允许范围"}
        
        # 生成签名并验证
        expected_signature = self._generate_signature(
            access_key.secret_access_key,
            request_data,
            timestamp
        )
        
        if not hmac.compare_digest(signature, expected_signature):
            return {"success": False, "error": "签名验证失败"}
        
        # 更新最后使用时间
        access_key.last_used_at = datetime.now()
        
        return {
            "success": True,
            "user_id": access_key.user_id,
            "permissions": access_key.permissions,
            "access_key_id": access_key_id
        }
    
    def _generate_signature(self, secret_key: str, request_data: Dict[str, Any],
                          timestamp: int) -> str:
        """生成签名"""
        # 创建待签名字符串
        sign_string = f"{timestamp}\n"
        for key in sorted(request_data.keys()):
            sign_string += f"{key}:{request_data[key]}\n"
        
        # 使用HMAC-SHA256生成签名
        signature = hmac.new(
            secret_key.encode('utf-8'),
            sign_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def get_user_access_keys(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的所有访问密钥"""
        if user_id not in self.user_keys:
            return []
        
        keys_info = []
        for key_id in self.user_keys[user_id]:
            if key_id in self.access_keys:
                key = self.access_keys[key_id]
                keys_info.append({
                    "access_key_id": key.access_key_id,
                    "description": key.description,
                    "created_at": key.created_at.isoformat(),
                    "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
                    "is_active": key.is_active,
                    "expiration_date": key.expiration_date.isoformat() if key.expiration_date else None,
                    "permissions": key.permissions
                })
        
        return keys_info
    
    def rotate_access_key(self, old_access_key_id: str) -> Dict[str, str]:
        """轮换访问密钥"""
        if old_access_key_id not in self.access_keys:
            return {"error": "旧访问密钥不存在"}
        
        old_key = self.access_keys[old_access_key_id]
        user_id = old_key.user_id
        
        # 生成新的密钥对
        new_key_pair = self.generate_access_key_pair(
            user_id,
            old_key.description + " (rotated)",
            (old_key.expiration_date - datetime.now()).days if old_key.expiration_date else None
        )
        
        # 复制权限
        new_key = self.access_keys[new_key_pair["access_key_id"]]
        new_key.permissions = old_key.permissions.copy()
        
        # 停用旧密钥
        self.deactivate_access_key(old_access_key_id)
        
        print(f"密钥轮换完成: {old_access_key_id} -> {new_key_pair['access_key_id']}")
        
        return new_key_pair

class AKSKRequestSigner:
    """AK/SK请求签名器"""
    
    def __init__(self, access_key_id: str, secret_access_key: str):
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
    
    def sign_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """签名请求"""
        timestamp = int(time.time())
        
        # 生成签名
        authenticator = AKSKAuthenticator()
        signature = authenticator._generate_signature(
            self.secret_access_key,
            request_data,
            timestamp
        )
        
        return {
            "access_key_id": self.access_key_id,
            "signature": signature,
            "timestamp": timestamp,
            "request_data": request_data
        }

# 使用示例
def demonstrate_ak_sk_authentication():
    """演示AK/SK认证"""
    # 创建AK/SK认证器
    ak_sk_auth = AKSKAuthenticator()
    
    # 生成访问密钥对
    print("生成访问密钥对...")
    key_pair1 = ak_sk_auth.generate_access_key_pair(
        "user-001",
        "用于API访问的密钥",
        expiration_days=90
    )
    print(f"密钥对1: {key_pair1}")
    
    key_pair2 = ak_sk_auth.generate_access_key_pair(
        "user-001",
        "用于CLI工具的密钥"
    )
    print(f"密钥对2: {key_pair2}")
    
    key_pair3 = ak_sk_auth.generate_access_key_pair(
        "user-002",
        "第三方应用密钥",
        expiration_days=30
    )
    print(f"密钥对3: {key_pair3}")
    
    # 为密钥添加权限
    print("\n为密钥添加权限...")
    ak_sk_auth.add_permissions_to_key(key_pair1["access_key_id"], ["read", "write"])
    ak_sk_auth.add_permissions_to_key(key_pair2["access_key_id"], ["read"])
    ak_sk_auth.add_permissions_to_key(key_pair3["access_key_id"], ["read", "list"])
    
    # 创建请求签名器
    signer = AKSKRequestSigner(
        key_pair1["access_key_id"],
        key_pair1["secret_access_key"]
    )
    
    # 签名请求
    print("\n签名请求...")
    request_data = {
        "action": "list_files",
        "bucket": "my-bucket",
        "prefix": "documents/"
    }
    
    signed_request = signer.sign_request(request_data)
    print(f"签名的请求: {signed_request}")
    
    # 认证请求
    print("\n认证请求...")
    auth_result = ak_sk_auth.authenticate_request(
        signed_request["access_key_id"],
        signed_request["signature"],
        signed_request["request_data"],
        signed_request["timestamp"]
    )
    print(f"认证结果: {auth_result['success']}")
    if auth_result['success']:
        print(f"用户ID: {auth_result['user_id']}")
        print(f"权限: {auth_result['permissions']}")
    
    # 测试无效签名
    print("\n测试无效签名...")
    invalid_auth_result = ak_sk_auth.authenticate_request(
        signed_request["access_key_id"],
        "invalid_signature",
        signed_request["request_data"],
        signed_request["timestamp"]
    )
    print(f"无效签名认证结果: {invalid_auth_result['error']}")
    
    # 停用密钥
    print("\n停用密钥...")
    ak_sk_auth.deactivate_access_key(key_pair1["access_key_id"])
    
    # 尝试使用已停用的密钥
    print("\n尝试使用已停用的密钥...")
    disabled_auth_result = ak_sk_auth.authenticate_request(
        signed_request["access_key_id"],
        signed_request["signature"],
        signed_request["request_data"],
        signed_request["timestamp"]
    )
    print(f"已停用密钥认证结果: {disabled_auth_result['error']}")
    
    # 激活密钥
    print("\n激活密钥...")
    ak_sk_auth.activate_access_key(key_pair1["access_key_id"])
    
    # 获取用户密钥信息
    print("\n获取用户密钥信息...")
    user_keys = ak_sk_auth.get_user_access_keys("user-001")
    print(f"用户 user-001 的密钥数量: {len(user_keys)}")
    for key_info in user_keys:
        print(f"  密钥ID: {key_info['access_key_id']}")
        print(f"    描述: {key_info['description']}")
        print(f"    状态: {'激活' if key_info['is_active'] else '停用'}")
        print(f"    权限: {key_info['permissions']}")
        print(f"    创建时间: {key_info['created_at']}")
        print(f"    最后使用: {key_info['last_used_at']}")
    
    # 轮换密钥
    print("\n轮换密钥...")
    rotated_key = ak_sk_auth.rotate_access_key(key_pair1["access_key_id"])
    print(f"轮换后的密钥: {rotated_key}")
    
    # 验证旧密钥已被停用
    old_key = ak_sk_auth.access_keys[key_pair1["access_key_id"]]
    print(f"旧密钥状态: {'激活' if old_key.is_active else '停用'}")
    
    # 验证新密钥权限
    new_key = ak_sk_auth.access_keys[rotated_key["access_key_id"]]
    print(f"新密钥权限: {new_key.permissions}")

# 运行演示
# demonstrate_ak_sk_authentication()
```

## 11.3 企业统一认证集成

在企业环境中，通常需要将分布式存储系统与现有的身份管理系统（如LDAP、Active Directory、OAuth2等）集成，以实现单点登录（SSO）和统一的用户管理。

### 11.3.1 SSO集成框架

```python
# SSO集成框架
import requests
import jwt
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

class SSOProvider:
    """SSO提供商基类"""
    
    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        self.configured = False
    
    def configure(self, config: Dict[str, Any]) -> bool:
        """配置SSO提供商"""
        self.config = config
        self.configured = True
        return True
    
    def authenticate(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """认证用户"""
        raise NotImplementedError
    
    def get_user_info(self, token: str) -> Dict[str, Any]:
        """获取用户信息"""
        raise NotImplementedError

class OAuth2Provider(SSOProvider):
    """OAuth2提供商"""
    
    def __init__(self):
        super().__init__("OAuth2")
        self.token_url = ""
        self.user_info_url = ""
        self.client_id = ""
        self.client_secret = ""
        self.redirect_uri = ""
    
    def configure(self, config: Dict[str, Any]) -> bool:
        """配置OAuth2提供商"""
        required_fields = ["token_url", "user_info_url", "client_id", "client_secret", "redirect_uri"]
        for field in required_fields:
            if field not in config:
                print(f"缺少必需的配置字段: {field}")
                return False
        
        self.token_url = config["token_url"]
        self.user_info_url = config["user_info_url"]
        self.client_id = config["client_id"]
        self.client_secret = config["client_secret"]
        self.redirect_uri = config["redirect_uri"]
        
        self.configured = True
        return True
    
    def authenticate(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """通过OAuth2认证用户"""
        if not self.configured:
            return {"success": False, "error": "提供商未配置"}
        
        # 构建令牌请求
        token_data = {
            "grant_type": "authorization_code",
            "code": credentials.get("code"),
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            # 请求访问令牌
            response = requests.post(self.token_url, data=token_data)
            if response.status_code != 200:
                return {"success": False, "error": f"令牌请求失败: {response.text}"}
            
            token_response = response.json()
            access_token = token_response.get("access_token")
            if not access_token:
                return {"success": False, "error": "未获得访问令牌"}
            
            # 获取用户信息
            user_info = self.get_user_info(access_token)
            if not user_info["success"]:
                return user_info
            
            return {
                "success": True,
                "access_token": access_token,
                "token_type": token_response.get("token_type", "Bearer"),
                "expires_in": token_response.get("expires_in"),
                "user_info": user_info["user_info"]
            }
        except Exception as e:
            return {"success": False, "error": f"认证请求失败: {str(e)}"}
    
    def get_user_info(self, token: str) -> Dict[str, Any]:
        """获取用户信息"""
        if not self.configured:
            return {"success": False, "error": "提供商未配置"}
        
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(self.user_info_url, headers=headers)
            if response.status_code != 200:
                return {"success": False, "error": f"获取用户信息失败: {response.text}"}
            
            user_info = response.json()
            return {
                "success": True,
                "user_info": {
                    "user_id": user_info.get("sub") or user_info.get("id"),
                    "username": user_info.get("username") or user_info.get("name"),
                    "email": user_info.get("email"),
                    "full_name": user_info.get("name") or user_info.get("full_name"),
                    "groups": user_info.get("groups", []),
                    "raw_info": user_info
                }
            }
        except Exception as e:
            return {"success": False, "error": f"获取用户信息失败: {str(e)}"}

class SAMLProvider(SSOProvider):
    """SAML提供商"""
    
    def __init__(self):
        super().__init__("SAML")
        self.idp_url = ""
        self.sp_entity_id = ""
        self.acs_url = ""
    
    def configure(self, config: Dict[str, Any]) -> bool:
        """配置SAML提供商"""
        required_fields = ["idp_url", "sp_entity_id", "acs_url"]
        for field in required_fields:
            if field not in config:
                print(f"缺少必需的配置字段: {field}")
                return False
        
        self.idp_url = config["idp_url"]
        self.sp_entity_id = config["sp_entity_id"]
        self.acs_url = config["acs_url"]
        
        self.configured = True
        return True
    
    def authenticate(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """通过SAML认证用户"""
        if not self.configured:
            return {"success": False, "error": "提供商未配置"}
        
        # SAML认证通常通过重定向完成，这里简化处理
        saml_response = credentials.get("SAMLResponse")
        if not saml_response:
            return {"success": False, "error": "缺少SAML响应"}
        
        # 解析SAML响应（简化实现）
        try:
            # 在实际实现中，需要使用专门的SAML库来解析响应
            user_info = self._parse_saml_response(saml_response)
            return {
                "success": True,
                "user_info": user_info
            }
        except Exception as e:
            return {"success": False, "error": f"SAML响应解析失败: {str(e)}"}
    
    def _parse_saml_response(self, saml_response: str) -> Dict[str, Any]:
        """解析SAML响应"""
        # 简化实现，实际中需要使用xml.etree.ElementTree等库
        # 这里返回模拟的用户信息
        return {
            "user_id": "saml_user_123",
            "username": "saml_user",
            "email": "saml_user@example.com",
            "full_name": "SAML User",
            "groups": ["saml_group"],
            "raw_info": {"saml_response": saml_response}
        }
    
    def get_user_info(self, token: str) -> Dict[str, Any]:
        """获取用户信息"""
        # SAML通常在认证时就返回了用户信息
        return {"success": False, "error": "SAML不支持通过令牌获取用户信息"}

class LDAPProvider(SSOProvider):
    """LDAP提供商"""
    
    def __init__(self):
        super().__init__("LDAP")
        self.server_url = ""
        self.base_dn = ""
        self.bind_dn = ""
        self.bind_password = ""
    
    def configure(self, config: Dict[str, Any]) -> bool:
        """配置LDAP提供商"""
        required_fields = ["server_url", "base_dn"]
        for field in required_fields:
            if field not in config:
                print(f"缺少必需的配置字段: {field}")
                return False
        
        self.server_url = config["server_url"]
        self.base_dn = config["base_dn"]
        self.bind_dn = config.get("bind_dn", "")
        self.bind_password = config.get("bind_password", "")
        
        self.configured = True
        return True
    
    def authenticate(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """通过LDAP认证用户"""
        if not self.configured:
            return {"success": False, "error": "提供商未配置"}
        
        username = credentials.get("username")
        password = credentials.get("password")
        
        if not username or not password:
            return {"success": False, "error": "缺少用户名或密码"}
        
        # 构建用户DN
        user_dn = f"uid={username},{self.base_dn}"
        
        # 在实际实现中，需要使用ldap3等库连接LDAP服务器
        # 这里简化处理，模拟LDAP认证
        try:
            # 模拟LDAP连接和认证
            if self._simulate_ldap_auth(user_dn, password):
                user_info = self._get_user_info_from_ldap(user_dn)
                return {
                    "success": True,
                    "user_info": user_info
                }
            else:
                return {"success": False, "error": "LDAP认证失败"}
        except Exception as e:
            return {"success": False, "error": f"LDAP认证异常: {str(e)}"}
    
    def _simulate_ldap_auth(self, user_dn: str, password: str) -> bool:
        """模拟LDAP认证"""
        # 简化实现，实际中需要连接LDAP服务器验证凭证
        # 这里假设认证成功
        return True
    
    def _get_user_info_from_ldap(self, user_dn: str) -> Dict[str, Any]:
        """从LDAP获取用户信息"""
        # 简化实现，实际中需要查询LDAP目录
        return {
            "user_id": user_dn,
            "username": user_dn.split(',')[0].split('=')[1],
            "email": f"{user_dn.split(',')[0].split('=')[1]}@example.com",
            "full_name": "LDAP User",
            "groups": ["ldap_group"],
            "raw_info": {"dn": user_dn}
        }
    
    def get_user_info(self, token: str) -> Dict[str, Any]:
        """获取用户信息"""
        # LDAP通常在认证时就返回了用户信息
        return {"success": False, "error": "LDAP不支持通过令牌获取用户信息"}

class SSOManager:
    """SSO管理器"""
    
    def __init__(self):
        self.providers: Dict[str, SSOProvider] = {}
        self.user_mappings: Dict[str, Dict[str, Any]] = {}
        self.session_manager = TokenAuthenticator()  # 复用之前的Token认证器
    
    def register_provider(self, provider_id: str, provider: SSOProvider) -> bool:
        """注册SSO提供商"""
        self.providers[provider_id] = provider
        print(f"SSO提供商 {provider.provider_name} ({provider_id}) 已注册")
        return True
    
    def configure_provider(self, provider_id: str, config: Dict[str, Any]) -> bool:
        """配置SSO提供商"""
        if provider_id not in self.providers:
            print(f"SSO提供商 {provider_id} 未注册")
            return False
        
        return self.providers[provider_id].configure(config)
    
    def authenticate_user(self, provider_id: str, 
                         credentials: Dict[str, Any]) -> Dict[str, Any]:
        """认证用户"""
        if provider_id not in self.providers:
            return {"success": False, "error": "SSO提供商未注册"}
        
        provider = self.providers[provider_id]
        if not provider.configured:
            return {"success": False, "error": "SSO提供商未配置"}
        
        # 通过提供商认证用户
        auth_result = provider.authenticate(credentials)
        if not auth_result["success"]:
            return auth_result
        
        user_info = auth_result["user_info"]
        
        # 映射外部用户到内部用户
        internal_user = self._map_external_user(provider_id, user_info)
        if not internal_user:
            return {"success": False, "error": "用户映射失败"}
        
        # 生成内部访问令牌
        access_token = self.session_manager.generate_access_token(
            internal_user["user_id"],
            permissions=internal_user.get("permissions", []),
            metadata={
                "external_provider": provider_id,
                "external_user_id": user_info["user_id"],
                "authenticated_at": datetime.now().isoformat()
            }
        )
        
        return {
            "success": True,
            "access_token": access_token,
            "user_info": internal_user,
            "provider": provider_id
        }
    
    def _map_external_user(self, provider_id: str, 
                          external_user_info: Dict[str, Any]) -> Dict[str, Any]:
        """映射外部用户到内部用户"""
        external_user_id = external_user_info["user_id"]
        mapping_key = f"{provider_id}:{external_user_id}"
        
        # 检查是否已有映射
        if mapping_key in self.user_mappings:
            return self.user_mappings[mapping_key]
        
        # 创建新的内部用户映射
        internal_user_id = f"ext_{provider_id}_{external_user_id}"
        internal_user = {
            "user_id": internal_user_id,
            "username": external_user_info["username"],
            "email": external_user_info["email"],
            "full_name": external_user_info["full_name"],
            "permissions": self._map_groups_to_permissions(external_user_info["groups"]),
            "external_provider": provider_id,
            "external_user_id": external_user_id,
            "created_at": datetime.now()
        }
        
        self.user_mappings[mapping_key] = internal_user
        print(f"创建用户映射: {external_user_id} -> {internal_user_id}")
        
        return internal_user
    
    def _map_groups_to_permissions(self, groups: List[str]) -> List[str]:
        """将用户组映射到权限"""
        # 简化的组到权限映射
        group_permissions = {
            "admins": ["admin", "user:manage", "data:manage"],
            "developers": ["data:read", "data:write"],
            "operators": ["data:read", "data:write"],
            "viewers": ["data:read"]
        }
        
        permissions = []
        for group in groups:
            if group in group_permissions:
                permissions.extend(group_permissions[group])
        
        # 去重
        return list(set(permissions))
    
    def validate_session(self, access_token: str) -> Dict[str, Any]:
        """验证会话"""
        return self.session_manager.validate_token(access_token)
    
    def get_provider_info(self) -> Dict[str, Any]:
        """获取提供商信息"""
        providers_info = {}
        for provider_id, provider in self.providers.items():
            providers_info[provider_id] = {
                "name": provider.provider_name,
                "configured": provider.configured
            }
        return providers_info

# 使用示例
def demonstrate_sso_integration():
    """演示SSO集成"""
    # 创建SSO管理器
    sso_manager = SSOManager()
    
    # 注册SSO提供商
    print("注册SSO提供商...")
    oauth_provider = OAuth2Provider()
    saml_provider = SAMLProvider()
    ldap_provider = LDAPProvider()
    
    sso_manager.register_provider("google_oauth", oauth_provider)
    sso_manager.register_provider("company_saml", saml_provider)
    sso_manager.register_provider("corp_ldap", ldap_provider)
    
    # 配置提供商
    print("\n配置OAuth2提供商...")
    oauth_config = {
        "token_url": "https://oauth2.googleapis.com/token",
        "user_info_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "client_id": "your-client-id",
        "client_secret": "your-client-secret",
        "redirect_uri": "https://your-app.com/callback"
    }
    sso_manager.configure_provider("google_oauth", oauth_config)
    
    print("\n配置SAML提供商...")
    saml_config = {
        "idp_url": "https://sso.company.com/saml/idp",
        "sp_entity_id": "https://your-app.com/saml/sp",
        "acs_url": "https://your-app.com/saml/acs"
    }
    sso_manager.configure_provider("company_saml", saml_config)
    
    print("\n配置LDAP提供商...")
    ldap_config = {
        "server_url": "ldap://ldap.company.com",
        "base_dn": "ou=users,dc=company,dc=com",
        "bind_dn": "cn=admin,dc=company,dc=com",
        "bind_password": "admin_password"
    }
    sso_manager.configure_provider("corp_ldap", ldap_config)
    
    # 显示提供商信息
    print("\nSSO提供商信息:")
    provider_info = sso_manager.get_provider_info()
    for provider_id, info in provider_info.items():
        print(f"  {provider_id}: {info['name']} (已配置: {info['configured']})")
    
    # 模拟OAuth2认证
    print("\n模拟OAuth2认证...")
    oauth_credentials = {
        "code": "oauth_authorization_code_123"
    }
    
    # 模拟OAuth2提供商的响应
    # 注意：在实际实现中，这里会调用真实的OAuth2提供商
    oauth_provider.user_info_url = ""  # 重置以避免实际HTTP请求
    
    # 手动设置模拟的用户信息
    oauth_user_info = {
        "sub": "oauth_user_123",
        "name": "OAuth User",
        "email": "oauth.user@example.com",
        "groups": ["developers", "viewers"]
    }
    
    # 临时覆盖authenticate方法以使用模拟数据
    original_authenticate = oauth_provider.authenticate
    def mock_oauth_authenticate(credentials):
        return {
            "success": True,
            "access_token": "oauth_access_token_123",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_info": {
                "user_id": oauth_user_info["sub"],
                "username": oauth_user_info["name"],
                "email": oauth_user_info["email"],
                "full_name": oauth_user_info["name"],
                "groups": oauth_user_info["groups"],
                "raw_info": oauth_user_info
            }
        }
    
    oauth_provider.authenticate = mock_oauth_authenticate
    
    # 执行认证
    oauth_result = sso_manager.authenticate_user("google_oauth", oauth_credentials)
    print(f"OAuth2认证结果: {oauth_result['success']}")
    if oauth_result['success']:
        print(f"访问令牌: {oauth_result['access_token'][:20]}...")
        print(f"用户信息: {oauth_result['user_info']['username']}")
        print(f"权限: {oauth_result['user_info']['permissions']}")
    
    # 恢复原始方法
    oauth_provider.authenticate = original_authenticate
    
    # 验证会话
    print("\n验证会话...")
    if oauth_result['success']:
        session_result = sso_manager.validate_session(oauth_result['access_token'])
        print(f"会话验证: {session_result['success']}")
        if session_result['success']:
            print(f"用户ID: {session_result['user_id']}")
            print(f"权限: {session_result['permissions']}")
    
    # 模拟SAML认证
    print("\n模拟SAML认证...")
    saml_credentials = {
        "SAMLResponse": "saml_response_data_123"
    }
    
    saml_result = sso_manager.authenticate_user("company_saml", saml_credentials)
    print(f"SAML认证结果: {saml_result['success']}")
    if saml_result['success']:
        print(f"用户信息: {saml_result['user_info']['username']}")
        print(f"权限: {saml_result['user_info']['permissions']}")
    
    # 显示用户映射
    print(f"\n用户映射数量: {len(sso_manager.user_mappings)}")
    for mapping_key, user_info in sso_manager.user_mappings.items():
        print(f"  {mapping_key} -> {user_info['user_id']}")

# 运行演示
# demonstrate_sso_integration()
```

通过以上实现，我们构建了完整的认证与授权体系，包括：

1. **密码认证**：支持用户注册、登录、密码修改和安全锁定机制
2. **Token认证**：基于JWT的访问令牌和刷新令牌机制
3. **RBAC授权**：灵活的基于角色的访问控制，支持角色层次和权限继承
4. **AK/SK认证**：适用于API和程序访问的密钥对认证
5. **SSO集成**：支持OAuth2、SAML和LDAP等多种企业级单点登录方案

这些机制可以单独使用或组合使用，为分布式文件存储平台提供全面的安全保护。