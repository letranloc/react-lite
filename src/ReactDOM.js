import * as _ from './util'
import { COMPONENT_ID, VELEMENT, VCOMPONENT } from './constant'
import { initVnode, destroyVnode, clearPendingComponents, compareTwoVnodes } from './virtual-dom'
import { updateQueue } from './Component'

let pendingRendering = {}
let vnodeStore = {}
let renderTreeIntoContainer = (vnode, container, callback, parentContext) => {
	if (!vnode.vtype) {
		throw new Error(`cannot render ${ vnode } to container`)
	}
	let id = container[COMPONENT_ID] || (container[COMPONENT_ID] = _.getUid())
	let argsCache = pendingRendering[id]

	// component lify cycle method maybe call root rendering
	// should bundle them and render by only one time
	if (argsCache) {
		if (argsCache === true) {
			pendingRendering[id] = argsCache = [vnode, callback, parentContext]
		} else {
			argsCache[0] = vnode
			argsCache[2] = parentContext
			if (callback) {
				argsCache[1] = argsCache[1] ? _.pipe(argsCache[1], callback) : callback
			}
		}
		return
	}

	pendingRendering[id] = true
	if (vnodeStore[id]) {
		compareTwoVnodes(vnodeStore[id], vnode, container.firstChild, parentContext)
	} else {
		var rootNode = initVnode(vnode, parentContext, container.namespaceURI)
		var childNode = null
		while (childNode = container.lastChild) {
			container.removeChild(childNode)
		}
		container.appendChild(rootNode)
	}
	vnodeStore[id] = vnode
	let isPending = updateQueue.isPending
	updateQueue.isPending = true
	clearPendingComponents(true)
	argsCache = pendingRendering[id]
	delete pendingRendering[id]

	let result = null
	if (_.isArr(argsCache)) {
		result = renderTreeIntoContainer(argsCache[0], container, argsCache[1], argsCache[2])
	} else if (vnode.vtype === VELEMENT) {
		result = container.firstChild
	} else if (vnode.vtype === VCOMPONENT) {
		result = container.firstChild.cache[vnode.id]
	}
	
	if (!isPending) {
		updateQueue.isPending = false
		updateQueue.batchUpdate()
	}

	if (callback) {
		callback.call(result)
	}
	
	return result
}

export let render = (vnode, container, callback) => {
	return renderTreeIntoContainer(vnode, container, callback)
}

export let unstable_renderSubtreeIntoContainer = (parentComponent, subVnode, container, callback) => {
	let context = parentComponent.vnode
	? parentComponent.vnode.context
	: parentComponent.$cache.parentContext
	return renderTreeIntoContainer(subVnode, container, callback, context)
}

export let unmountComponentAtNode = container => {
	if (!container.nodeName) {
		throw new Error('expect node')
	}
	let id = container[COMPONENT_ID]
	if (vnodeStore[id]) {
		destroyVnode(vnodeStore[id], container.firstChild)
		let childNode = null
		while (childNode = container.lastChild) {
			container.removeChild(childNode)
		}
		delete vnodeStore[id]
		return true
	}
	return false
}

export let findDOMNode = node => {
	if (node == null) {
		return null
	}
	if (node.nodeName) {
		return node
	}
	let component = node
	// if component.node equal to false, component must be unmounted
	if (component.getDOMNode && component.$cache.isMounted) {
		return component.getDOMNode()
	}
	throw new Error('findDOMNode can not find Node')
}