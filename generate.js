
/*
 * @Description: 
 * @Author: zxd
 * @Date: 2023-03-30 17:42:18
 * @LastEditTime: 2023-06-06 10:21:58
 * @LastEditors: zxd
 */
import Vue from 'vue'
import router from '@/router/router'

// 现在也就是最后使用的组件实例
var instaceCur = null
// 用来判断容器元素是否在使用中
var containerShow = false
const container = document.createElement('div')
document.body.appendChild(container)

/**
 * @description: 注册组件
 * @author: zxd
 * @return {*}
 * @param {*} requireComponent 组件文件对象或数组
 * @param {*} mode 采用的组件模式 单例/多例 single/multiple
 */
export const registerComponent = function(requireComponent, mode = 'single') {
  // // 如果是数组，就依次去遍历然后进行注册
  if (Array.isArray(requireComponent)) {
    const componentObj = {}
    requireComponent.forEach(($vnode) => {
      // 如果是用require，那么就需要default才能获取到具体组件对象
      $vnode = $vnode.default || $vnode
      const componentName = $vnode.name || $vnode.__file.replace(/.*\//, '').replace(/\.\w+$/, '')
      componentObj[componentName] = componentMode[mode]($vnode, mode)
    })
    return componentObj
  } else {
  // 如果是用require，那么就需要default才能获取到具体组件对象
    const $vnode = requireComponent.default || requireComponent
    return componentMode[mode]($vnode, mode)
  }
}

// 组件注册模式开始
const componentMode = {
  single: regiterSignle,
  multiple: regiterMultiple

}

function regiterSignle($vnode, mode) {
  const instance = { value: null }
  return function(option) {
    return initComponent.call(this, option, $vnode, mode, instance)
  }
}
function regiterMultiple($vnode, mode) {
  return function(option) {
    return initComponent.call(this, option, $vnode, mode)
  }
}
// 组件注册模式结束

// 初始化组件
function initComponent(option, $vnode, mode, instance = {}) {
  const F_this = this // 调用该函数所用的this，需要使用该函数的时候用call或者bind之类去改变this
  // 这里主要是用在判断是不是首次调用该函数，因为在路由离开时会清除所有组件包括容器元素的下的元素，因此这里判断如果是当前路由首次就去执行一次挂载
  if (!containerShow) {
    containerShow = true
    document.body.appendChild(container)
  }
  if (!instance.value) {
    // 这里的this，就是该函数被应用时所在的vue文件下
    // 这个动作必须放在实例构造器之前，因为inject/provide的步骤是在created之前
    if (F_this && F_this._provided) {
      $vnode.beforeCreate.unshift(function() {
        // 这里是$vnode实例后的this，如果if条件内的this不同
        this._provided = F_this._provided
      })
    }
    const Constructor = Vue.extend({ ...$vnode, router })

    instance.value = new Constructor()

    instance.value._destory = () => {
      instance.value.close ? instance.value.close() : ''
      instance.value.$destroy()
      instance.value = null
      instaceCur = null
      if (containerShow) {
        container.remove()
        containerShow = false
      }
    }
    // 监听父组件销毁时，调用组件销毁方法
    F_this.$once('hook:beforeDestroy', instance.value._destory)
  }
  return initInstance.call(F_this, option, mode, instance.value, F_this)
}

// 对组件内容进行初始化开始

const defaultShowMode = {
  single: 'cover',
  multiple: 'overlay'
}
/**
 * @description: 去对组件内容进行初始化函数
 * @author: zxd
 * @return {*}
 * start
 * @param {*} initparams 包含以下属性的对象
 * @param {object} prop 组件的prop
 * @param {object} option 组件（this）的下的键值对
 * @param {object} events 注册的事件
 * @param {object} slots 插槽的内容
 * @param {string} showMode 显示的模式，覆盖/叠加 cover/overlay
 * @param {object} ESCAPE_POD 逃生舱，包含一下属性的对象
 * @param {Boolean} ESCAPE_POD.registerEvent 无论什么模式下，每次都会重新去注册事件
 * end
 * @param {*} mode 模式，单例/多例 single/multiple
 * @param {*} instance 当前初始化组件的实例（this）
 */
function initInstance({ props, option, events, slots, showMode, ESCAPE_POD, isCache = true } = {}, mode, instance) {
  // 如果不需要缓存data数据，则进行初始化
  if (!isCache && instance.$el && mode === 'single') {
    Object.assign(instance.$data, instance.$options.data())
  }
  showMode = showMode || defaultShowMode[mode]
  mixinSlot(instance, slots)
  initData(instance, option)
  registerProp.call(this, instance, props)
  // 如果新实例和最后使用的实例相同则不需要去进行挂载，直接返回实例子就好
  if (instaceCur && instaceCur._uid === instance._uid) return instance
  if (showMode === 'cover') {
    // 如果是要覆盖的显示方式，将显示组件的容器元素置空，并且有正在使用的实例便使用close关闭（如果有close方法的话，这里大致就是弹窗内必有的close方法）
    container.innerHTML = ''
    instaceCur && instaceCur.close ? instaceCur.close() : ''
    // 单例如果被挂着过一次，那么事件也应当注册过，考虑到实际业务需求，没必要再帮他重新去注册事件了(可以使用逃生舱，每次都强行去注册一遍)
    !instance.$el || ESCAPE_POD && ESCAPE_POD.registerEvent ? registerEmit(instance, events) : ''
  }
  if (showMode === 'overlay') registerEmit(instance, events)
  // 这里是用来判断实例是否有挂载过，如果挂载过就会有$el,没有则进行挂载(实际上，这里的判断更大哦是针对单例的情况)
  !instance.$el ? instance.$mount() : ''

  // 将现在也就是最后使用的组件实例存储起来
  instaceCur = instance
  container.appendChild(instance.$el)
  // 最后将实例返回，如果引用组件的文件用变量去存储它，就可以随意使用它了
  return instance
}
// 对组件内容进行初始化结束

/**
 * @description: 初始化组件的data函数
 * @author: zxd
 * @return {*}
 */
function initData(instance, option) {
  option = option || {}
  // 因为可能会有参数变化，所以最好每次打开都重新重置下参数，并且用深拷贝防止与外界产生联系
  for (const key in option) {
    if (option[key] && option[key] instanceof Object && instance[key]) {
      if (option[key] instanceof Array) {
        instance[key] = JSON.parse(JSON.stringify(option[key]))
      } else {
        Object.assign(instance[key], JSON.parse(JSON.stringify(option[key])))
      }
    } else {
      instance[key] = option[key]
    }
  }
}
/**
 * @description: 混入插槽
 * @author: zxd
 * @return {*}
 * @param {*} instance
 */
function mixinSlot(instance, slots) {
  slots = slots || {}
  for (const key in slots) {
    if (Array.isArray(slots[key])) {
      slots[key][1] = slots[key][1] || {}
      slots[key][1].on['Close'] = registerProp({ instance, visible: false })
      instance.$slots[key] = instance.$createElement(slots[key][0], slots[key][1])
    } else {
      instance.$slots[key] = instance.$createElement(slots[key])
    }
  }
}
/**
 * @description: 注册/更新props的函数
 * @author: zxd
 * @return {*}
 */
export function registerProp(instance, props) {
  props = props || {}
  for (const key in props) {
    if (Object.prototype.hasOwnProperty.call(instance._props, key)) {
      if (Array.isArray(props[key])) {
        // instance.$set(instance._props, key, this.props[key][0])
        if (!instance.__watchers) instance.__watchers = {}
        if (instance.__watchers[key]) instance.__watchers[key]() // 清除旧监听清
        instance.__watchers[key] = this.$watch(props[key][0], function(v) {
          instance._props[key] = v
        },{immediate:true})
      } else {
        instance.$set(instance._props, key, props[key])
      }
    } else {
      throw new Error(`There are no ${key} in the props;please define it in the props`)
    }
  }
}
/**
 * @description: 注册事件的函数Emit
 * @author: zxd
 * @return {*}
 */
function registerEmit(instance, events) {
  events = events || {}
  for (const key in events) {
    if (!instance._events[key]) instance.$on(key, events[key])
  }
}

