import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { LibraryBrowser } from '@/SDKs/LibrarySDK/ui/LibraryBrowser'
import { useOpenLibraryItem } from '@/SDKs/LibrarySDK/ui/LibraryBrowser/use-open-item'
import type { Library } from '@pretzel-graph/shared/domain'

export const Route = createFileRoute('/home/library')({
    component: LibraryLayout,
})

function LibraryLayout() {
    const navigate = useNavigate()
    const openItem = useOpenLibraryItem()
    const { folderId } = useParams({ strict: false })
    const cwd = folderId as Library.Folder.Id

    const setCwd = (folderId: Library.Folder.Id) => navigate({ to: '/home/library/$folderId', params: { folderId } })

    return (
        <LibraryBrowser.Root cwd={cwd} setCwd={setCwd} onItemClick={openItem}>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 pl-4">

                {/* Search input cannot be underneath a mask because blur stops working >:( */}
                <div className='relative'>
                    <LibraryBrowser.Tree.Header className='top-[60px]'>
                        <LibraryBrowser.Tree.SearchInput
                            className='rounded-full!'
                            size="sm"
                            wrapperClassName='flex-1 mr-2'
                        />
                    </LibraryBrowser.Tree.Header>
                    <LibraryBrowser.Tree
                        scrollContainerClassName="h-screen [mask-image:linear-gradient(to_bottom,transparent_8px,black_72px)]"
                        className={"pt-[95px] pr-2"}
                    />
                </div>


                <Outlet />
            </div>
        </LibraryBrowser.Root>
    )
}
